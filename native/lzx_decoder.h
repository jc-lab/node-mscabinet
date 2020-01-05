#include <stdint.h>

#include <vector>
#include <string>

extern "C" {
#define	ARCHIVE_EOF	  1	/* Found end of archive. */
#define	ARCHIVE_OK	  0	/* Operation was successful. */
#define	ARCHIVE_RETRY	(-10)	/* Retry might succeed. */
#define	ARCHIVE_WARN	(-20)	/* Partial success. */
/* For example, if write_header "fails", then you can't push data. */
#define	ARCHIVE_FAILED	(-25)	/* Current operation cannot complete. */
/* But if write_header is "fatal," then this archive is dead and useless. */
#define	ARCHIVE_FATAL	(-30)	/* No more operations are possible. */

struct lzx_stream {
    const unsigned char *next_in;
    int64_t avail_in;
    int64_t total_in;
    unsigned char *next_out;
    int64_t avail_out;
    int64_t total_out;
    struct lzx_dec *ds;
};
}

extern int	 lzx_decode_init(struct lzx_stream *, int);
extern void lzx_decode_free(struct lzx_stream *);
extern void lzx_cleanup_bitstream(struct lzx_stream *);
extern int	 lzx_decode(struct lzx_stream *, int);

class LzxDecoder {
private:
    lzx_stream stream_;

public:
    std::vector<uint8_t> out_buf;

    LzxDecoder();
    ~LzxDecoder();
    void cleanupBitstream();
    int init(int w_bits);

    struct DecodeOutput {
        int result;
        int in_bytes;
        int out_bytes;
    };

    DecodeOutput decode(const std::string& input, int last);
    void outputBufferTranslation(uint32_t length, uint32_t offset);
    int64_t getTotalOut() const;
};
