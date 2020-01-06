# node-mscabinet

## Example

```javascript
import { Extract, CFFile } from 'cabinet';
import * as path from 'path';
import * as fs from 'fs';

const extract = new Extract();
const dist = './dist';
fs.createReadStream('input.cab').pipe(extract)
    .on('entry', (file: CFFile, stream, next) => {
        const target = path.resolve(dist, '.' + file.name);
        const dirname = path.dirname(target);
        fs.mkdirSync(dirname, {recursive: true});
        stream
            .pipe(fs.createWriteStream(target))
            .on('finish', () => next());
    })
    .on('close', () => {
        console.log("ONCLOSE");
    });
```
