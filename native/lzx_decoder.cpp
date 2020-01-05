#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <limits.h>

#include "lzx_decoder.h"

#include "archive_endian.h"

/*-
 * Copyright (c) 2010-2012 Michihiro NAKAJIMA
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR(S) ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE AUTHOR(S) BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

struct huffman {
    int		 len_size;
    int		 freq[17];
    unsigned char	*bitlen;

    /*
     * Use a index table. It's faster than searching a huffman
     * coding tree, which is a binary tree. But a use of a large
     * index table causes L1 cache read miss many times.
     */
    int		 max_bits;
    int		 tbl_bits;
    int		 tree_used;
    /* Direct access table. */
    uint16_t	*tbl;
};

struct lzx_br {
#define CACHE_TYPE		uint64_t
#define CACHE_BITS		(8 * sizeof(CACHE_TYPE))
    /* Cache buffer. */
    CACHE_TYPE	 cache_buffer;
    /* Indicates how many bits avail in cache_buffer. */
    int		 cache_avail;
    unsigned char	 odd;
    char		 have_odd;
};

struct lzx_pos_tbl {
    int		 base;
    int		 footer_bits;
};

struct lzx_dec {
    /* Decoding status. */
    int     		 state;

    /*
     * Window to see last decoded data, from 32KBi to 2MBi.
     */
    int			 w_size;
    int			 w_mask;
    /* Window buffer, which is a loop buffer. */
    unsigned char		*w_buff;
    /* The insert position to the window. */
    int			 w_pos;
    /* The position where we can copy decoded code from the window. */
    int     		 copy_pos;
    /* The length how many bytes we can copy decoded code from
     * the window. */
    int     		 copy_len;
    /* Translation reversal for x86 processor CALL byte sequence(E8).
     * This is used for LZX only. */
    uint32_t		 translation_size;
    char			 translation;
    char			 block_type;
#define VERBATIM_BLOCK		1
#define ALIGNED_OFFSET_BLOCK	2
#define UNCOMPRESSED_BLOCK	3
    size_t			 block_size;
    size_t			 block_bytes_avail;
    /* Repeated offset. */
    int			 r0, r1, r2;
    unsigned char		 rbytes[4];
    int			 rbytes_avail;
    int			 length_header;
    int			 position_slot;
    int			 offset_bits;

    struct lzx_pos_tbl *pos_tbl;
    /*
     * Bit stream reader.
     */
    struct lzx_br br;

    /*
     * Huffman coding.
     */
    struct huffman at, lt, mt, pt;

    int			 loop;
    int			 error;
};

static const int slots[] = {
    30, 32, 34, 36, 38, 42, 50, 66, 98, 162, 290
};
#define SLOT_BASE	15
#define SLOT_MAX	21/*->25*/

int	 lzx_decode_init(struct lzx_stream *, int);
static int	 lzx_read_blocks(struct lzx_stream *, int);
static int	 lzx_decode_blocks(struct lzx_stream *, int);
void lzx_decode_free(struct lzx_stream *);
static void lzx_translation(struct lzx_stream *, void *, size_t, uint32_t);
void lzx_cleanup_bitstream(struct lzx_stream *);
int	 lzx_decode(struct lzx_stream *, int);
static int	lzx_read_pre_tree(struct lzx_stream *);
static int	lzx_read_bitlen(struct lzx_stream *, struct huffman *, int);
static int	lzx_huffman_init(struct huffman *, size_t, int);
static void	lzx_huffman_free(struct huffman *);
static int	lzx_make_huffman_table(struct huffman *);
static inline int lzx_decode_huffman(struct huffman *, unsigned);

/*****************************************************************
 *
 * LZX decompression code.
 *
 *****************************************************************/

/*
 * Initialize LZX decoder.
 *
 * Returns ARCHIVE_OK if initialization was successful.
 * Returns ARCHIVE_FAILED if w_bits has unsupported value.
 * Returns ARCHIVE_FATAL if initialization failed; memory allocation
 * error occurred.
 */
int
lzx_decode_init(struct lzx_stream *strm, int w_bits)
{
    struct lzx_dec *ds;
    int slot, w_size, w_slot;
    int base, footer;
    int base_inc[18];

    if (strm->ds == NULL) {
        strm->ds = (struct lzx_dec*)calloc(1, sizeof(*strm->ds));
        if (strm->ds == NULL)
            return (ARCHIVE_FATAL);
    }
    ds = strm->ds;
    ds->error = ARCHIVE_FAILED;

    /* Allow bits from 15(32KBi) up to 21(2MBi) */
    if (w_bits < SLOT_BASE || w_bits > SLOT_MAX)
        return (ARCHIVE_FAILED);

    ds->error = ARCHIVE_FATAL;

    /*
     * Alloc window
     */
    w_size = ds->w_size;
    w_slot = slots[w_bits - SLOT_BASE];
    ds->w_size = 1U << w_bits;
    ds->w_mask = ds->w_size -1;
    if (ds->w_buff == NULL || w_size != ds->w_size) {
        free(ds->w_buff);
        ds->w_buff = (unsigned char*)malloc(ds->w_size);
        if (ds->w_buff == NULL)
            return (ARCHIVE_FATAL);
        free(ds->pos_tbl);
        ds->pos_tbl = (struct lzx_pos_tbl*)malloc(sizeof(ds->pos_tbl[0]) * w_slot);
        if (ds->pos_tbl == NULL)
            return (ARCHIVE_FATAL);
        lzx_huffman_free(&(ds->mt));
    }

    for (footer = 0; footer < 18; footer++)
        base_inc[footer] = 1 << footer;
    base = footer = 0;
    for (slot = 0; slot < w_slot; slot++) {
        int n;
        if (footer == 0)
            base = slot;
        else
            base += base_inc[footer];
        if (footer < 17) {
            footer = -2;
            for (n = base; n; n >>= 1)
                footer++;
            if (footer <= 0)
                footer = 0;
        }
        ds->pos_tbl[slot].base = base;
        ds->pos_tbl[slot].footer_bits = footer;
    }

    ds->w_pos = 0;
    ds->state = 0;
    ds->br.cache_buffer = 0;
    ds->br.cache_avail = 0;
    ds->r0 = ds->r1 = ds->r2 = 1;

    /* Initialize aligned offset tree. */
    if (lzx_huffman_init(&(ds->at), 8, 8) != ARCHIVE_OK)
        return (ARCHIVE_FATAL);

    /* Initialize pre-tree. */
    if (lzx_huffman_init(&(ds->pt), 20, 10) != ARCHIVE_OK)
        return (ARCHIVE_FATAL);

    /* Initialize Main tree. */
    if (lzx_huffman_init(&(ds->mt), 256+(w_slot<<3), 16)
        != ARCHIVE_OK)
        return (ARCHIVE_FATAL);

    /* Initialize Length tree. */
    if (lzx_huffman_init(&(ds->lt), 249, 16) != ARCHIVE_OK)
        return (ARCHIVE_FATAL);

    ds->error = 0;

    return (ARCHIVE_OK);
}

/*
 * Release LZX decoder.
 */
void
lzx_decode_free(struct lzx_stream *strm)
{

    if (strm->ds == NULL)
        return;
    free(strm->ds->w_buff);
    free(strm->ds->pos_tbl);
    lzx_huffman_free(&(strm->ds->at));
    lzx_huffman_free(&(strm->ds->pt));
    lzx_huffman_free(&(strm->ds->mt));
    lzx_huffman_free(&(strm->ds->lt));
    free(strm->ds);
    strm->ds = NULL;
}

/*
 * E8 Call Translation reversal.
 */
void
lzx_translation(struct lzx_stream *strm, void *p, size_t size, uint32_t offset)
{
    struct lzx_dec *ds = strm->ds;
    unsigned char *b, *end;

    if (!ds->translation || size <= 10)
        return;
    b = (unsigned char*)p;
    end = b + size - 10;
    while (b < end && (b = (unsigned char *)memchr(b, 0xE8, end - b)) != NULL) {
        size_t i = b - (unsigned char *)p;
        int32_t cp, displacement, value;

        cp = (int32_t)(offset + (uint32_t)i);
        value = archive_le32dec(&b[1]);
        if (value >= -cp && value < (int32_t)ds->translation_size) {
            if (value >= 0)
                displacement = value - cp;
            else
                displacement = value + ds->translation_size;
            archive_le32enc(&b[1], (uint32_t)displacement);
        }
        b += 5;
    }
}

/*
 * Bit stream reader.
 */
/* Check that the cache buffer has enough bits. */
#define lzx_br_has(br, n)	((br)->cache_avail >= n)
/* Get compressed data by bit. */
#define lzx_br_bits(br, n)				\
	(((uint32_t)((br)->cache_buffer >>		\
		((br)->cache_avail - (n)))) & cache_masks[n])
#define lzx_br_bits_forced(br, n)			\
	(((uint32_t)((br)->cache_buffer <<		\
		((n) - (br)->cache_avail))) & cache_masks[n])
/* Read ahead to make sure the cache buffer has enough compressed data we
 * will use.
 *  True  : completed, there is enough data in the cache buffer.
 *  False : we met that strm->next_in is empty, we have to get following
 *          bytes. */
#define lzx_br_read_ahead_0(strm, br, n)	\
	(lzx_br_has((br), (n)) || lzx_br_fillup(strm, br))
/*  True  : the cache buffer has some bits as much as we need.
 *  False : there are no enough bits in the cache buffer to be used,
 *          we have to get following bytes if we could. */
#define lzx_br_read_ahead(strm, br, n)	\
	(lzx_br_read_ahead_0((strm), (br), (n)) || lzx_br_has((br), (n)))

/* Notify how many bits we consumed. */
#define lzx_br_consume(br, n)	((br)->cache_avail -= (n))
#define lzx_br_consume_unaligned_bits(br) ((br)->cache_avail &= ~0x0f)

#define lzx_br_is_unaligned(br)	((br)->cache_avail & 0x0f)

static const uint32_t cache_masks[] = {
    0x00000000, 0x00000001, 0x00000003, 0x00000007,
    0x0000000F, 0x0000001F, 0x0000003F, 0x0000007F,
    0x000000FF, 0x000001FF, 0x000003FF, 0x000007FF,
    0x00000FFF, 0x00001FFF, 0x00003FFF, 0x00007FFF,
    0x0000FFFF, 0x0001FFFF, 0x0003FFFF, 0x0007FFFF,
    0x000FFFFF, 0x001FFFFF, 0x003FFFFF, 0x007FFFFF,
    0x00FFFFFF, 0x01FFFFFF, 0x03FFFFFF, 0x07FFFFFF,
    0x0FFFFFFF, 0x1FFFFFFF, 0x3FFFFFFF, 0x7FFFFFFF,
    0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF
};

/*
 * Shift away used bits in the cache data and fill it up with following bits.
 * Call this when cache buffer does not have enough bits you need.
 *
 * Returns 1 if the cache buffer is full.
 * Returns 0 if the cache buffer is not full; input buffer is empty.
 */
static int
lzx_br_fillup(struct lzx_stream *strm, struct lzx_br *br)
{
/*
 * x86 processor family can read misaligned data without an access error.
 */
    int n = CACHE_BITS - br->cache_avail;

    for (;;) {
        switch (n >> 4) {
            case 4:
                if (strm->avail_in >= 8) {
                    br->cache_buffer =
                        ((uint64_t)strm->next_in[1]) << 56 |
                            ((uint64_t)strm->next_in[0]) << 48 |
                            ((uint64_t)strm->next_in[3]) << 40 |
                            ((uint64_t)strm->next_in[2]) << 32 |
                            ((uint32_t)strm->next_in[5]) << 24 |
                            ((uint32_t)strm->next_in[4]) << 16 |
                            ((uint32_t)strm->next_in[7]) << 8 |
                            (uint32_t)strm->next_in[6];
                    strm->next_in += 8;
                    strm->avail_in -= 8;
                    br->cache_avail += 8 * 8;
                    return (1);
                }
                break;
            case 3:
                if (strm->avail_in >= 6) {
                    br->cache_buffer =
                        (br->cache_buffer << 48) |
                            ((uint64_t)strm->next_in[1]) << 40 |
                            ((uint64_t)strm->next_in[0]) << 32 |
                            ((uint32_t)strm->next_in[3]) << 24 |
                            ((uint32_t)strm->next_in[2]) << 16 |
                            ((uint32_t)strm->next_in[5]) << 8 |
                            (uint32_t)strm->next_in[4];
                    strm->next_in += 6;
                    strm->avail_in -= 6;
                    br->cache_avail += 6 * 8;
                    return (1);
                }
                break;
            case 0:
                /* We have enough compressed data in
                 * the cache buffer.*/
                return (1);
            default:
                break;
        }
        if (strm->avail_in < 2) {
            /* There is not enough compressed data to
             * fill up the cache buffer. */
            if (strm->avail_in == 1) {
                br->odd = *strm->next_in++;
                strm->avail_in--;
                br->have_odd = 1;
            }
            return (0);
        }
        br->cache_buffer =
            (br->cache_buffer << 16) |
                archive_le16dec(strm->next_in);
        strm->next_in += 2;
        strm->avail_in -= 2;
        br->cache_avail += 16;
        n -= 16;
    }
}

static void
lzx_br_fixup(struct lzx_stream *strm, struct lzx_br *br)
{
    int n = CACHE_BITS - br->cache_avail;

    if (br->have_odd && n >= 16 && strm->avail_in > 0) {
        br->cache_buffer =
            (br->cache_buffer << 16) |
                ((uint16_t)(*strm->next_in)) << 8 | br->odd;
        strm->next_in++;
        strm->avail_in--;
        br->cache_avail += 16;
        br->have_odd = 0;
    }
}

void
lzx_cleanup_bitstream(struct lzx_stream *strm)
{
    strm->ds->br.cache_avail = 0;
    strm->ds->br.have_odd = 0;
}

/*
 * Decode LZX.
 *
 * 1. Returns ARCHIVE_OK if output buffer or input buffer are empty.
 *    Please set available buffer and call this function again.
 * 2. Returns ARCHIVE_EOF if decompression has been completed.
 * 3. Returns ARCHIVE_FAILED if an error occurred; compressed data
 *    is broken or you do not set 'last' flag properly.
 */
#define ST_RD_TRANSLATION	0
#define ST_RD_TRANSLATION_SIZE	1
#define ST_RD_BLOCK_TYPE	2
#define ST_RD_BLOCK_SIZE	3
#define ST_RD_ALIGNMENT		4
#define ST_RD_R0		5
#define ST_RD_R1		6
#define ST_RD_R2		7
#define ST_COPY_UNCOMP1		8
#define ST_COPY_UNCOMP2		9
#define ST_RD_ALIGNED_OFFSET	10
#define ST_RD_VERBATIM		11
#define ST_RD_PRE_MAIN_TREE_256	12
#define ST_MAIN_TREE_256	13
#define ST_RD_PRE_MAIN_TREE_REM	14
#define ST_MAIN_TREE_REM	15
#define ST_RD_PRE_LENGTH_TREE	16
#define ST_LENGTH_TREE		17
#define ST_MAIN			18
#define ST_LENGTH		19
#define ST_OFFSET		20
#define ST_REAL_POS		21
#define ST_COPY			22

int
lzx_decode(struct lzx_stream *strm, int last)
{
    struct lzx_dec *ds = strm->ds;
    int64_t avail_in;
    int r;

    if (ds->error)
        return (ds->error);

    avail_in = strm->avail_in;
    lzx_br_fixup(strm, &(ds->br));
    do {
        if (ds->state < ST_MAIN)
            r = lzx_read_blocks(strm, last);
        else {
            int64_t bytes_written = strm->avail_out;
            r = lzx_decode_blocks(strm, last);
            bytes_written -= strm->avail_out;
            strm->next_out += bytes_written;
            strm->total_out += bytes_written;
        }
    } while (r == 100);
    strm->total_in += avail_in - strm->avail_in;
    return (r);
}

static int
lzx_read_blocks(struct lzx_stream *strm, int last)
{
    struct lzx_dec *ds = strm->ds;
    struct lzx_br *br = &(ds->br);
    int i, r;

    for (;;) {
        switch (ds->state) {
            case ST_RD_TRANSLATION:
                if (!lzx_br_read_ahead(strm, br, 1)) {
                    ds->state = ST_RD_TRANSLATION;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                ds->translation = lzx_br_bits(br, 1);
                lzx_br_consume(br, 1);
                /* FALL THROUGH */
            case ST_RD_TRANSLATION_SIZE:
                if (ds->translation) {
                    if (!lzx_br_read_ahead(strm, br, 32)) {
                        ds->state = ST_RD_TRANSLATION_SIZE;
                        if (last)
                            goto failed;
                        return (ARCHIVE_OK);
                    }
                    ds->translation_size = lzx_br_bits(br, 16);
                    lzx_br_consume(br, 16);
                    ds->translation_size <<= 16;
                    ds->translation_size |= lzx_br_bits(br, 16);
                    lzx_br_consume(br, 16);
                }
                /* FALL THROUGH */
            case ST_RD_BLOCK_TYPE:
                if (!lzx_br_read_ahead(strm, br, 3)) {
                    ds->state = ST_RD_BLOCK_TYPE;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                ds->block_type = lzx_br_bits(br, 3);
                lzx_br_consume(br, 3);
                /* Check a block type. */
                switch (ds->block_type) {
                    case VERBATIM_BLOCK:
                    case ALIGNED_OFFSET_BLOCK:
                    case UNCOMPRESSED_BLOCK:
                        break;
                    default:
                        goto failed;/* Invalid */
                }
                /* FALL THROUGH */
            case ST_RD_BLOCK_SIZE:
                if (!lzx_br_read_ahead(strm, br, 24)) {
                    ds->state = ST_RD_BLOCK_SIZE;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                ds->block_size = lzx_br_bits(br, 8);
                lzx_br_consume(br, 8);
                ds->block_size <<= 16;
                ds->block_size |= lzx_br_bits(br, 16);
                lzx_br_consume(br, 16);
                if (ds->block_size == 0)
                    goto failed;
                ds->block_bytes_avail = ds->block_size;
                if (ds->block_type != UNCOMPRESSED_BLOCK) {
                    if (ds->block_type == VERBATIM_BLOCK)
                        ds->state = ST_RD_VERBATIM;
                    else
                        ds->state = ST_RD_ALIGNED_OFFSET;
                    break;
                }
                /* FALL THROUGH */
            case ST_RD_ALIGNMENT:
                /*
                 * Handle an Uncompressed Block.
                 */
                /* Skip padding to align following field on
                 * 16-bit boundary. */
                if (lzx_br_is_unaligned(br))
                    lzx_br_consume_unaligned_bits(br);
                else {
                    if (lzx_br_read_ahead(strm, br, 16))
                        lzx_br_consume(br, 16);
                    else {
                        ds->state = ST_RD_ALIGNMENT;
                        if (last)
                            goto failed;
                        return (ARCHIVE_OK);
                    }
                }
                /* Preparation to read repeated offsets R0,R1 and R2. */
                ds->rbytes_avail = 0;
                ds->state = ST_RD_R0;
                /* FALL THROUGH */
            case ST_RD_R0:
            case ST_RD_R1:
            case ST_RD_R2:
                do {
                    uint16_t u16;
                    /* Drain bits in the cache buffer of
                     * bit-stream. */
                    if (lzx_br_has(br, 32)) {
                        u16 = lzx_br_bits(br, 16);
                        lzx_br_consume(br, 16);
                        archive_le16enc(ds->rbytes, u16);
                        u16 = lzx_br_bits(br, 16);
                        lzx_br_consume(br, 16);
                        archive_le16enc(ds->rbytes+2, u16);
                        ds->rbytes_avail = 4;
                    } else if (lzx_br_has(br, 16)) {
                        u16 = lzx_br_bits(br, 16);
                        lzx_br_consume(br, 16);
                        archive_le16enc(ds->rbytes, u16);
                        ds->rbytes_avail = 2;
                    }
                    if (ds->rbytes_avail < 4 && ds->br.have_odd) {
                        ds->rbytes[ds->rbytes_avail++] =
                            ds->br.odd;
                        ds->br.have_odd = 0;
                    }
                    while (ds->rbytes_avail < 4) {
                        if (strm->avail_in <= 0) {
                            if (last)
                                goto failed;
                            return (ARCHIVE_OK);
                        }
                        ds->rbytes[ds->rbytes_avail++] =
                            *strm->next_in++;
                        strm->avail_in--;
                    }
                    ds->rbytes_avail = 0;
                    if (ds->state == ST_RD_R0) {
                        ds->r0 = archive_le32dec(ds->rbytes);
                        if (ds->r0 < 0)
                            goto failed;
                        ds->state = ST_RD_R1;
                    } else if (ds->state == ST_RD_R1) {
                        ds->r1 = archive_le32dec(ds->rbytes);
                        if (ds->r1 < 0)
                            goto failed;
                        ds->state = ST_RD_R2;
                    } else if (ds->state == ST_RD_R2) {
                        ds->r2 = archive_le32dec(ds->rbytes);
                        if (ds->r2 < 0)
                            goto failed;
                        /* We've gotten all repeated offsets. */
                        ds->state = ST_COPY_UNCOMP1;
                    }
                } while (ds->state != ST_COPY_UNCOMP1);
                /* FALL THROUGH */
            case ST_COPY_UNCOMP1:
                /*
                 * Copy bytes form next_in to next_out directly.
                 */
                while (ds->block_bytes_avail) {
                    int l;

                    if (strm->avail_out <= 0)
                        /* Output buffer is empty. */
                        return (ARCHIVE_OK);
                    if (strm->avail_in <= 0) {
                        /* Input buffer is empty. */
                        if (last)
                            goto failed;
                        return (ARCHIVE_OK);
                    }
                    l = (int)ds->block_bytes_avail;
                    if (l > ds->w_size - ds->w_pos)
                        l = ds->w_size - ds->w_pos;
                    if (l > strm->avail_out)
                        l = (int)strm->avail_out;
                    if (l > strm->avail_in)
                        l = (int)strm->avail_in;
                    memcpy(strm->next_out, strm->next_in, l);
                    memcpy(&(ds->w_buff[ds->w_pos]),
                           strm->next_in, l);
                    strm->next_in += l;
                    strm->avail_in -= l;
                    strm->next_out += l;
                    strm->avail_out -= l;
                    strm->total_out += l;
                    ds->w_pos = (ds->w_pos + l) & ds->w_mask;
                    ds->block_bytes_avail -= l;
                }
                /* FALL THROUGH */
            case ST_COPY_UNCOMP2:
                /* Re-align; skip padding byte. */
                if (ds->block_size & 1) {
                    if (strm->avail_in <= 0) {
                        /* Input buffer is empty. */
                        ds->state = ST_COPY_UNCOMP2;
                        if (last)
                            goto failed;
                        return (ARCHIVE_OK);
                    }
                    strm->next_in++;
                    strm->avail_in --;
                }
                /* This block ended. */
                ds->state = ST_RD_BLOCK_TYPE;
                return (ARCHIVE_EOF);
                /********************/
            case ST_RD_ALIGNED_OFFSET:
                /*
                 * Read Aligned offset tree.
                 */
                if (!lzx_br_read_ahead(strm, br, 3 * ds->at.len_size)) {
                    ds->state = ST_RD_ALIGNED_OFFSET;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                memset(ds->at.freq, 0, sizeof(ds->at.freq));
                for (i = 0; i < ds->at.len_size; i++) {
                    ds->at.bitlen[i] = lzx_br_bits(br, 3);
                    ds->at.freq[ds->at.bitlen[i]]++;
                    lzx_br_consume(br, 3);
                }
                if (!lzx_make_huffman_table(&ds->at))
                    goto failed;
                /* FALL THROUGH */
            case ST_RD_VERBATIM:
                ds->loop = 0;
                /* FALL THROUGH */
            case ST_RD_PRE_MAIN_TREE_256:
                /*
                 * Read Pre-tree for first 256 elements of main tree.
                 */
                if (!lzx_read_pre_tree(strm)) {
                    ds->state = ST_RD_PRE_MAIN_TREE_256;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                if (!lzx_make_huffman_table(&ds->pt))
                    goto failed;
                ds->loop = 0;
                /* FALL THROUGH */
            case ST_MAIN_TREE_256:
                /*
                 * Get path lengths of first 256 elements of main tree.
                 */
                r = lzx_read_bitlen(strm, &ds->mt, 256);
                if (r < 0)
                    goto failed;
                else if (!r) {
                    ds->state = ST_MAIN_TREE_256;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                ds->loop = 0;
                /* FALL THROUGH */
            case ST_RD_PRE_MAIN_TREE_REM:
                /*
                 * Read Pre-tree for remaining elements of main tree.
                 */
                if (!lzx_read_pre_tree(strm)) {
                    ds->state = ST_RD_PRE_MAIN_TREE_REM;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                if (!lzx_make_huffman_table(&ds->pt))
                    goto failed;
                ds->loop = 256;
                /* FALL THROUGH */
            case ST_MAIN_TREE_REM:
                /*
                 * Get path lengths of remaining elements of main tree.
                 */
                r = lzx_read_bitlen(strm, &ds->mt, -1);
                if (r < 0)
                    goto failed;
                else if (!r) {
                    ds->state = ST_MAIN_TREE_REM;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                if (!lzx_make_huffman_table(&ds->mt))
                    goto failed;
                ds->loop = 0;
                /* FALL THROUGH */
            case ST_RD_PRE_LENGTH_TREE:
                /*
                 * Read Pre-tree for remaining elements of main tree.
                 */
                if (!lzx_read_pre_tree(strm)) {
                    ds->state = ST_RD_PRE_LENGTH_TREE;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                if (!lzx_make_huffman_table(&ds->pt))
                    goto failed;
                ds->loop = 0;
                /* FALL THROUGH */
            case ST_LENGTH_TREE:
                /*
                 * Get path lengths of remaining elements of main tree.
                 */
                r = lzx_read_bitlen(strm, &ds->lt, -1);
                if (r < 0)
                    goto failed;
                else if (!r) {
                    ds->state = ST_LENGTH_TREE;
                    if (last)
                        goto failed;
                    return (ARCHIVE_OK);
                }
                if (!lzx_make_huffman_table(&ds->lt))
                    goto failed;
                ds->state = ST_MAIN;
                return (100);
        }
    }
    failed:
    return (ds->error = ARCHIVE_FAILED);
}

int
lzx_decode_blocks(struct lzx_stream *strm, int last)
{
    struct lzx_dec *ds = strm->ds;
    struct lzx_br bre = ds->br;
    struct huffman *at = &(ds->at), *lt = &(ds->lt), *mt = &(ds->mt);
    const struct lzx_pos_tbl *pos_tbl = ds->pos_tbl;
    unsigned char *noutp = strm->next_out;
    unsigned char *endp = noutp + strm->avail_out;
    unsigned char *w_buff = ds->w_buff;
    unsigned char *at_bitlen = at->bitlen;
    unsigned char *lt_bitlen = lt->bitlen;
    unsigned char *mt_bitlen = mt->bitlen;
    size_t block_bytes_avail = ds->block_bytes_avail;
    int at_max_bits = at->max_bits;
    int lt_max_bits = lt->max_bits;
    int mt_max_bits = mt->max_bits;
    int c, copy_len = ds->copy_len, copy_pos = ds->copy_pos;
    int w_pos = ds->w_pos, w_mask = ds->w_mask, w_size = ds->w_size;
    int length_header = ds->length_header;
    int offset_bits = ds->offset_bits;
    int position_slot = ds->position_slot;
    int r0 = ds->r0, r1 = ds->r1, r2 = ds->r2;
    int state = ds->state;
    char block_type = ds->block_type;

    for (;;) {
        switch (state) {
            case ST_MAIN:
                for (;;) {
                    if (block_bytes_avail == 0) {
                        /* This block ended. */
                        ds->state = ST_RD_BLOCK_TYPE;
                        ds->br = bre;
                        ds->block_bytes_avail =
                            block_bytes_avail;
                        ds->copy_len = copy_len;
                        ds->copy_pos = copy_pos;
                        ds->length_header = length_header;
                        ds->position_slot = position_slot;
                        ds->r0 = r0; ds->r1 = r1; ds->r2 = r2;
                        ds->w_pos = w_pos;
                        strm->avail_out = endp - noutp;
                        return (ARCHIVE_EOF);
                    }
                    if (noutp >= endp)
                        /* Output buffer is empty. */
                        goto next_data;

                    if (!lzx_br_read_ahead(strm, &bre,
                                           mt_max_bits)) {
                        if (!last)
                            goto next_data;
                        /* Remaining bits are less than
                         * maximum bits(mt.max_bits) but maybe
                         * it still remains as much as we need,
                         * so we should try to use it with
                         * dummy bits. */
                        c = lzx_decode_huffman(mt,
                                               lzx_br_bits_forced(
                                                   &bre, mt_max_bits));
                        lzx_br_consume(&bre, mt_bitlen[c]);
                        if (!lzx_br_has(&bre, 0))
                            goto failed;/* Over read. */
                    } else {
                        c = lzx_decode_huffman(mt,
                                               lzx_br_bits(&bre, mt_max_bits));
                        lzx_br_consume(&bre, mt_bitlen[c]);
                    }
                    if (c > UCHAR_MAX)
                        break;
                    /*
                     * 'c' is exactly literal code.
                     */
                    /* Save a decoded code to reference it
                     * afterward. */
                    w_buff[w_pos] = c;
                    w_pos = (w_pos + 1) & w_mask;
                    /* Store the decoded code to output buffer. */
                    *noutp++ = c;
                    block_bytes_avail--;
                }
                /*
                 * Get a match code, its length and offset.
                 */
                c -= UCHAR_MAX + 1;
                length_header = c & 7;
                position_slot = c >> 3;
                /* FALL THROUGH */
            case ST_LENGTH:
                /*
                 * Get a length.
                 */
                if (length_header == 7) {
                    if (!lzx_br_read_ahead(strm, &bre,
                                           lt_max_bits)) {
                        if (!last) {
                            state = ST_LENGTH;
                            goto next_data;
                        }
                        c = lzx_decode_huffman(lt,
                                               lzx_br_bits_forced(
                                                   &bre, lt_max_bits));
                        lzx_br_consume(&bre, lt_bitlen[c]);
                        if (!lzx_br_has(&bre, 0))
                            goto failed;/* Over read. */
                    } else {
                        c = lzx_decode_huffman(lt,
                                               lzx_br_bits(&bre, lt_max_bits));
                        lzx_br_consume(&bre, lt_bitlen[c]);
                    }
                    copy_len = c + 7 + 2;
                } else
                    copy_len = length_header + 2;
                if ((size_t)copy_len > block_bytes_avail)
                    goto failed;
                /*
                 * Get an offset.
                 */
                switch (position_slot) {
                    case 0: /* Use repeated offset 0. */
                        copy_pos = r0;
                        state = ST_REAL_POS;
                        continue;
                    case 1: /* Use repeated offset 1. */
                        copy_pos = r1;
                        /* Swap repeated offset. */
                        r1 = r0;
                        r0 = copy_pos;
                        state = ST_REAL_POS;
                        continue;
                    case 2: /* Use repeated offset 2. */
                        copy_pos = r2;
                        /* Swap repeated offset. */
                        r2 = r0;
                        r0 = copy_pos;
                        state = ST_REAL_POS;
                        continue;
                    default:
                        offset_bits =
                            pos_tbl[position_slot].footer_bits;
                        break;
                }
                /* FALL THROUGH */
            case ST_OFFSET:
                /*
                 * Get the offset, which is a distance from
                 * current window position.
                 */
                if (block_type == ALIGNED_OFFSET_BLOCK &&
                    offset_bits >= 3) {
                    int offbits = offset_bits - 3;

                    if (!lzx_br_read_ahead(strm, &bre, offbits)) {
                        state = ST_OFFSET;
                        if (last)
                            goto failed;
                        goto next_data;
                    }
                    copy_pos = lzx_br_bits(&bre, offbits) << 3;

                    /* Get an aligned number. */
                    if (!lzx_br_read_ahead(strm, &bre,
                                           offbits + at_max_bits)) {
                        if (!last) {
                            state = ST_OFFSET;
                            goto next_data;
                        }
                        lzx_br_consume(&bre, offbits);
                        c = lzx_decode_huffman(at,
                                               lzx_br_bits_forced(&bre,
                                                                  at_max_bits));
                        lzx_br_consume(&bre, at_bitlen[c]);
                        if (!lzx_br_has(&bre, 0))
                            goto failed;/* Over read. */
                    } else {
                        lzx_br_consume(&bre, offbits);
                        c = lzx_decode_huffman(at,
                                               lzx_br_bits(&bre, at_max_bits));
                        lzx_br_consume(&bre, at_bitlen[c]);
                    }
                    /* Add an aligned number. */
                    copy_pos += c;
                } else {
                    if (!lzx_br_read_ahead(strm, &bre,
                                           offset_bits)) {
                        state = ST_OFFSET;
                        if (last)
                            goto failed;
                        goto next_data;
                    }
                    copy_pos = lzx_br_bits(&bre, offset_bits);
                    lzx_br_consume(&bre, offset_bits);
                }
                copy_pos += pos_tbl[position_slot].base -2;

                /* Update repeated offset LRU queue. */
                r2 = r1;
                r1 = r0;
                r0 = copy_pos;
                /* FALL THROUGH */
            case ST_REAL_POS:
                /*
                 * Compute a real position in window.
                 */
                copy_pos = (w_pos - copy_pos) & w_mask;
                /* FALL THROUGH */
            case ST_COPY:
                /*
                 * Copy several bytes as extracted data from the window
                 * into the output buffer.
                 */
                for (;;) {
                    const unsigned char *s;
                    int l;

                    l = copy_len;
                    if (copy_pos > w_pos) {
                        if (l > w_size - copy_pos)
                            l = w_size - copy_pos;
                    } else {
                        if (l > w_size - w_pos)
                            l = w_size - w_pos;
                    }
                    if (noutp + l >= endp)
                        l = (int)(endp - noutp);
                    s = w_buff + copy_pos;
                    if (l >= 8 && ((copy_pos + l < w_pos)
                        || (w_pos + l < copy_pos))) {
                        memcpy(w_buff + w_pos, s, l);
                        memcpy(noutp, s, l);
                    } else {
                        unsigned char *d;
                        int li;

                        d = w_buff + w_pos;
                        for (li = 0; li < l; li++)
                            noutp[li] = d[li] = s[li];
                    }
                    noutp += l;
                    copy_pos = (copy_pos + l) & w_mask;
                    w_pos = (w_pos + l) & w_mask;
                    block_bytes_avail -= l;
                    if (copy_len <= l)
                        /* A copy of current pattern ended. */
                        break;
                    copy_len -= l;
                    if (noutp >= endp) {
                        /* Output buffer is empty. */
                        state = ST_COPY;
                        goto next_data;
                    }
                }
                state = ST_MAIN;
                break;
        }
    }
    failed:
    return (ds->error = ARCHIVE_FAILED);
    next_data:
    ds->br = bre;
    ds->block_bytes_avail = block_bytes_avail;
    ds->copy_len = copy_len;
    ds->copy_pos = copy_pos;
    ds->length_header = length_header;
    ds->offset_bits = offset_bits;
    ds->position_slot = position_slot;
    ds->r0 = r0; ds->r1 = r1; ds->r2 = r2;
    ds->state = state;
    ds->w_pos = w_pos;
    strm->avail_out = endp - noutp;
    return (ARCHIVE_OK);
}

static int
lzx_read_pre_tree(struct lzx_stream *strm)
{
    struct lzx_dec *ds = strm->ds;
    struct lzx_br *br = &(ds->br);
    int i;

    if (ds->loop == 0)
        memset(ds->pt.freq, 0, sizeof(ds->pt.freq));
    for (i = ds->loop; i < ds->pt.len_size; i++) {
        if (!lzx_br_read_ahead(strm, br, 4)) {
            ds->loop = i;
            return (0);
        }
        ds->pt.bitlen[i] = lzx_br_bits(br, 4);
        ds->pt.freq[ds->pt.bitlen[i]]++;
        lzx_br_consume(br, 4);
    }
    ds->loop = i;
    return (1);
}

/*
 * Read a bunch of bit-lengths from pre-tree.
 */
static int
lzx_read_bitlen(struct lzx_stream *strm, struct huffman *d, int end)
{
    struct lzx_dec *ds = strm->ds;
    struct lzx_br *br = &(ds->br);
    int c, i, j, ret, same;
    unsigned rbits;

    i = ds->loop;
    if (i == 0)
        memset(d->freq, 0, sizeof(d->freq));
    ret = 0;
    if (end < 0)
        end = d->len_size;
    while (i < end) {
        ds->loop = i;
        if (!lzx_br_read_ahead(strm, br, ds->pt.max_bits))
            goto getdata;
        rbits = lzx_br_bits(br, ds->pt.max_bits);
        c = lzx_decode_huffman(&(ds->pt), rbits);
        switch (c) {
            case 17:/* several zero lengths, from 4 to 19. */
                if (!lzx_br_read_ahead(strm, br, ds->pt.bitlen[c]+4))
                    goto getdata;
                lzx_br_consume(br, ds->pt.bitlen[c]);
                same = lzx_br_bits(br, 4) + 4;
                if (i + same > end)
                    return (-1);/* Invalid */
                lzx_br_consume(br, 4);
                for (j = 0; j < same; j++)
                    d->bitlen[i++] = 0;
                break;
            case 18:/* many zero lengths, from 20 to 51. */
                if (!lzx_br_read_ahead(strm, br, ds->pt.bitlen[c]+5))
                    goto getdata;
                lzx_br_consume(br, ds->pt.bitlen[c]);
                same = lzx_br_bits(br, 5) + 20;
                if (i + same > end)
                    return (-1);/* Invalid */
                lzx_br_consume(br, 5);
                memset(d->bitlen + i, 0, same);
                i += same;
                break;
            case 19:/* a few same lengths. */
                if (!lzx_br_read_ahead(strm, br,
                                       ds->pt.bitlen[c]+1+ds->pt.max_bits))
                    goto getdata;
                lzx_br_consume(br, ds->pt.bitlen[c]);
                same = lzx_br_bits(br, 1) + 4;
                if (i + same > end)
                    return (-1);
                lzx_br_consume(br, 1);
                rbits = lzx_br_bits(br, ds->pt.max_bits);
                c = lzx_decode_huffman(&(ds->pt), rbits);
                lzx_br_consume(br, ds->pt.bitlen[c]);
                c = (d->bitlen[i] - c + 17) % 17;
                if (c < 0)
                    return (-1);/* Invalid */
                for (j = 0; j < same; j++)
                    d->bitlen[i++] = c;
                d->freq[c] += same;
                break;
            default:
                lzx_br_consume(br, ds->pt.bitlen[c]);
                c = (d->bitlen[i] - c + 17) % 17;
                if (c < 0)
                    return (-1);/* Invalid */
                d->freq[c]++;
                d->bitlen[i++] = c;
                break;
        }
    }
    ret = 1;
    getdata:
    ds->loop = i;
    return (ret);
}

static int
lzx_huffman_init(struct huffman *hf, size_t len_size, int tbl_bits)
{

    if (hf->bitlen == NULL || hf->len_size != (int)len_size) {
        free(hf->bitlen);
        hf->bitlen = (unsigned char*)calloc(len_size,  sizeof(hf->bitlen[0]));
        if (hf->bitlen == NULL)
            return (ARCHIVE_FATAL);
        hf->len_size = (int)len_size;
    } else
        memset(hf->bitlen, 0, len_size *  sizeof(hf->bitlen[0]));
    if (hf->tbl == NULL) {
        hf->tbl = (uint16_t*)malloc(((size_t)1 << tbl_bits) * sizeof(hf->tbl[0]));
        if (hf->tbl == NULL)
            return (ARCHIVE_FATAL);
        hf->tbl_bits = tbl_bits;
    }
    return (ARCHIVE_OK);
}

static void
lzx_huffman_free(struct huffman *hf)
{
    free(hf->bitlen);
    free(hf->tbl);
}

/*
 * Make a huffman coding table.
 */
static int
lzx_make_huffman_table(struct huffman *hf)
{
    uint16_t *tbl;
    const unsigned char *bitlen;
    int bitptn[17], weight[17];
    int i, maxbits = 0, ptn, tbl_size, w;
    int len_avail;

    /*
     * Initialize bit patterns.
     */
    ptn = 0;
    for (i = 1, w = 1 << 15; i <= 16; i++, w >>= 1) {
        bitptn[i] = ptn;
        weight[i] = w;
        if (hf->freq[i]) {
            ptn += hf->freq[i] * w;
            maxbits = i;
        }
    }
    if ((ptn & 0xffff) != 0 || maxbits > hf->tbl_bits)
        return (0);/* Invalid */

    hf->max_bits = maxbits;

    /*
     * Cut out extra bits which we won't house in the table.
     * This preparation reduces the same calculation in the for-loop
     * making the table.
     */
    if (maxbits < 16) {
        int ebits = 16 - maxbits;
        for (i = 1; i <= maxbits; i++) {
            bitptn[i] >>= ebits;
            weight[i] >>= ebits;
        }
    }

    /*
     * Make the table.
     */
    tbl_size = 1 << hf->tbl_bits;
    tbl = hf->tbl;
    bitlen = hf->bitlen;
    len_avail = hf->len_size;
    hf->tree_used = 0;
    for (i = 0; i < len_avail; i++) {
        uint16_t *p;
        int len, cnt;

        if (bitlen[i] == 0)
            continue;
        /* Get a bit pattern */
        len = bitlen[i];
        if (len > tbl_size)
            return (0);
        ptn = bitptn[len];
        cnt = weight[len];
        /* Calculate next bit pattern */
        if ((bitptn[len] = ptn + cnt) > tbl_size)
            return (0);/* Invalid */
        /* Update the table */
        p = &(tbl[ptn]);
        while (--cnt >= 0)
            p[cnt] = (uint16_t)i;
    }
    return (1);
}

static inline int
lzx_decode_huffman(struct huffman *hf, unsigned rbits)
{
    int c;
    c = hf->tbl[rbits];
    if (c < hf->len_size)
        return (c);
    return (0);
}

#include <iostream>

LzxDecoder::LzxDecoder()
    : stream_({nullptr, 0, 0, nullptr, 0, 0, nullptr})
{
    out_buf.resize(32768);
}

LzxDecoder::~LzxDecoder() {
    lzx_decode_free(&stream_);
}

void LzxDecoder::cleanupBitstream() {
    lzx_cleanup_bitstream(&stream_);
}

int LzxDecoder::init(int w_bits) {
    return lzx_decode_init(&stream_, w_bits);
}

LzxDecoder::DecodeOutput LzxDecoder::decode(const std::string& input, int last) {
    DecodeOutput output;

    stream_.next_out = (unsigned char*)out_buf.data();
    stream_.avail_out = out_buf.size();

    stream_.next_in = (const unsigned char *) input.data();
    stream_.avail_in = input.size();
    output.result = lzx_decode(&stream_, last);

    output.in_bytes = input.size() - stream_.avail_in;
    output.out_bytes = out_buf.size() - stream_.avail_out;

    return output;
}

void LzxDecoder::outputBufferTranslation(uint32_t length, uint32_t offset) {
    lzx_translation(&stream_, (void*)out_buf.data(), length, offset);
}

int64_t LzxDecoder::getTotalOut() const {
    return this->stream_.total_out;
}
