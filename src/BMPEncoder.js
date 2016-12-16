'use strict';

const IOBuffer = require('iobuffer');
const constants = require('./constants');
const tableLeft = [];
for (var i = 0; i <= 8; i++) {
    tableLeft.push(0b11111111 << i);
}

class BMPEncoder extends IOBuffer {
    constructor(data) {
        if (data.bitDepth !== 1) {
            throw new Error('Only bitDepth of 1 is supported');
        }
        if (!data.height || !data.width) {
            throw new Error('ImageData width and height are required');
        }

        super(data.data);

        this.width = data.width;
        this.height = data.height;
        this.bitDepth = data.bitDepth;
        this.channels = data.channels;
        this.components = data.components;
    }

    encode() {
        this.encoded = new IOBuffer();
        this.encoded.skip(14);
        this.writeBitmapV5Header();
        this.writeColorTable();
        const offset = this.encoded.offset;
        this.writePixelArray();
        this.encoded.rewind();
        this.writeBitmapFileHeader(offset);
        return this.encoded.getBuffer();
    }

    writePixelArray() {
        var io = this.encoded;
        const rowSize = Math.floor((this.bitDepth * this.width + 31) / 32) * 4;
        const dataRowSize = Math.ceil(this.bitDepth * this.width / 8);
        const skipSize = rowSize - dataRowSize;
        const bitOverflow = (this.bitDepth * this.width) % 8;
        const bitSkip = bitOverflow === 0 ? 0 : 8 - bitOverflow;
        const totalBytes = rowSize * this.height;

        var byteA, byteB;
        let offset = 0; // Current off set in the ioData
        let relOffset = 0, iOffset = 8;
        io.mark();
        byteB = this.readUint8();
        for (var i = this.height - 1; i >= 0; i--) {
            const lastRow = (i === 0);
            io.reset();
            io.skip(i * rowSize);
            for (var j = 0; j < dataRowSize; j++) {
                const lastCol = (j === dataRowSize - 1);
                if (relOffset <= bitSkip && lastCol) {
                    // no need to read new data
                    io.writeByte((byteB << relOffset));
                    if ((bitSkip === 0 || bitSkip === relOffset) && !lastRow) {
                        byteA = byteB;
                        byteB = this.readByte();
                    }
                } else if (relOffset === 0) {
                    byteA = byteB;
                    byteB = this.readUint8();
                    io.writeByte(byteA);
                } else {
                    byteA = byteB;
                    byteB = this.readUint8();
                    io.writeByte(((byteA << relOffset) & tableLeft[relOffset]) | (byteB >> iOffset));
                }
                if (lastCol) {
                    offset += (bitOverflow || 8);
                    io.skip(skipSize);
                    relOffset = offset % 8;
                    iOffset = 8 - relOffset;
                } else {
                    offset += 8;
                }
            }
        }
        if (rowSize > dataRowSize) {
            // make sure last written byte is correct
            io.reset();
            io.skip(totalBytes - 1);
            io.writeUint8(0);
        }

    }

    writeColorTable() {
        // We only handle 1-bit images
        this.encoded
            .writeUint32(0x00000000)  // black
            .writeUint32(0x00ffffff); // white
    }

    writeBitmapFileHeader(imageOffset) {
        this.encoded
            .writeChars('BM')                           // 14 bytes bitmap file header
            .writeInt32(this.encoded._lastWrittenByte)  // Size of BMP file in bytes
            .writeUint16(0)
            .writeUint16(0)
            .writeUint32(imageOffset);
    }

    writeBitmapV5Header() {
        // Size of the header
        this.encoded
            .writeUint32(124)   // Header size
            .writeInt32(this.width) // bV5Width
            .writeInt32(this.height) // bV5Height
            .writeUint16(1)               // bv5Planes - must be set to 1
            .writeUint16(this.bitDepth) // bV5BitCount
            .writeUint32(constants.BITMAPV5HEADER.Compression.BI_RGB)  // bV5Compression - No compression
            .writeUint32(this.width * this.height * this.bitDepth) // bv5SizeImage - buffer size (optional if uncompressed)
            .writeInt32(0)  // bV5XPelsPerMeter - resolution
            .writeInt32(0)  // bV5YPelsPerMeter - resolution
            .writeUint32(Math.pow(2, this.bitDepth))
            .writeUint32(Math.pow(2, this.bitDepth))
            .writeUint32(0xff000000) // bV5RedMask
            .writeUint32(0x00ff0000) // bV5GreenMask
            .writeUint32(0x0000ff00) // bV5BlueMask
            .writeUint32(0x000000ff) // bV5AlphaMask
            .writeUint32(constants.BITMAPV5HEADER.LogicalColorSpace.LCS_sRGB)
            .skip(36)                // bV5Endpoints
            .skip(12)                // bV5GammaRed, Green, Blue
            .writeUint32(constants.BITMAPV5HEADER.GamutMappingIntent.LCS_GM_IMAGES)
            .skip(12);               // ProfileData, ProfileSize, Reserved
    }
}

// module.exports = function (imageData) {
//     var io = new IOBuffer();
//     // skip header
//     io.skip(14);
//     writeBitmapV5Header(io, imageData);
//     writeColorTable(io);
//     const imageOffset = io.offset;
//     writePixelArray(io, imageData);
//
//     // write header at the end
//     io.rewind();
//     writeBitmapFileHeader(io, imageOffset);
//     return io.getBuffer();
// };

// function writePixelArray(io, imgData) {
//     const rowSize = Math.floor((imgData.bitDepth * imgData.width + 31) / 32) * 4;
//     const dataRowSize = Math.ceil(imgData.bitDepth * imgData.width / 8);
//     const skipSize = rowSize - dataRowSize;
//     const bitOverflow = (imgData.bitDepth * imgData.width) % 8;
//     const bitSkip = bitOverflow === 0 ? 0 : 8 - bitOverflow;
//     const totalBytes = rowSize * imgData.height;
//
//     var byteA, byteB;
//     const ioData = new IOBuffer(imgData.data);
//     let offset = 0; // Current off set in the ioData
//     let relOffset = 0, iOffset = 8;
//     io.mark();
//     byteB = ioData.readUint8();
//     for (var i = imgData.height - 1; i >= 0; i--) {
//         const lastRow = (i === 0);
//         io.reset();
//         io.skip(i * rowSize);
//         for (var j = 0; j < dataRowSize; j++) {
//             const lastCol = (j === dataRowSize - 1);
//             if (relOffset <= bitSkip && lastCol) {
//                 // no need to read new data
//                 io.writeByte((byteB << relOffset));
//                 if ((bitSkip === 0 || bitSkip === relOffset) && !lastRow) {
//                     byteA = byteB;
//                     byteB = ioData.readByte();
//                 }
//             } else if (relOffset === 0) {
//                 byteA = byteB;
//                 byteB = ioData.readUint8();
//                 io.writeByte(byteA);
//             } else {
//                 byteA = byteB;
//                 byteB = ioData.readUint8();
//                 io.writeByte(((byteA << relOffset) & tableLeft[relOffset]) | (byteB >> iOffset));
//             }
//             if (lastCol) {
//                 offset += (bitOverflow || 8);
//                 io.skip(skipSize);
//                 relOffset = offset % 8;
//                 iOffset = 8 - relOffset;
//             } else {
//                 offset += 8;
//             }
//         }
//     }
//     if (rowSize > dataRowSize) {
//         // make sure last written byte is correct
//         io.reset();
//         io.skip(totalBytes - 1);
//         io.writeUint8(0);
//     }
//
// }

// function writeColorTable(io) {
//     // We only handle 1-bit images
//     io
//         .writeUint32(0x00000000) // black
//         .writeUint32(0x00ffffff); //white
// }

// function writeBitmapFileHeader(io, imageOffset) {
//     // 14 bytes bitmap file header
//     io.writeChars('BM');
//     // Size of BMP file in bytes
//     io.writeInt32(io._lastWrittenByte);
//     io.writeUint16(0);
//     io.writeUint16(0);
//     io.writeUint32(imageOffset);
// }

// function writeBitmapV5Header(io, imgData) {
//     // Size of the header
//     io
//         .writeUint32(124)   // Header size
//         .writeInt32(imgData.width) // bV5Width
//         .writeInt32(imgData.height) // bV5Height
//         .writeUint16(1)               // bv5Planes - must be set to 1
//         .writeUint16(imgData.bitDepth) // bV5BitCount
//         .writeUint32(constants.BITMAPV5HEADER.Compression.BI_RGB)  // bV5Compression - No compression
//         .writeUint32(imgData.width * imgData.height * imgData.bitDepth) // bv5SizeImage - buffer size (optional if uncompressed)
//         .writeInt32(0)  // bV5XPelsPerMeter - resolution
//         .writeInt32(0)  // bV5YPelsPerMeter - resolution
//         .writeUint32(Math.pow(2, imgData.bitDepth))
//         .writeUint32(Math.pow(2, imgData.bitDepth))
//         .writeUint32(0xff000000) // bV5RedMask
//         .writeUint32(0x00ff0000) // bV5GreenMask
//         .writeUint32(0x0000ff00) // bV5BlueMask
//         .writeUint32(0x000000ff) // bV5AlphaMask
//         .writeUint32(constants.BITMAPV5HEADER.LogicalColorSpace.LCS_sRGB)
//         .skip(36)                // bV5Endpoints
//         .skip(12)                // bV5GammaRed, Green, Blue
//         .writeUint32(constants.BITMAPV5HEADER.GamutMappingIntent.LCS_GM_IMAGES)
//         .skip(12);               // ProfileData, ProfileSize, Reserved
// }

module.exports = BMPEncoder;