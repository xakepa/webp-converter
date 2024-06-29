import path from 'path';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import glob from 'glob';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

let dirInput = path.resolve(process.cwd()) + path.sep + 'input';
let dirOutput = path.resolve(process.cwd()) + path.sep + 'output';
let quality = 100;
let chunks = false;

const argv = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    description: 'Location of the source images',
    type: 'string'
  })
  .option('output', {
    alias: 'o',
    description: 'Location of the destination (WebP) images',
    type: 'string'
  })
  .option('quality', {
    alias: 'q',
    description: 'Percentage of output quality between 0% (Worst) and 100% (Best)',
    type: 'number'
  })
  .option('chunks', {
    alias: 'c',
    description: 'Split files in single directory by how many chunks',
    type: 'number'
  })
  .help()
  .alias('help', 'h')
  .argv;

if (argv.input) {
  if (fs.existsSync(argv.input) && fs.lstatSync(argv.input).isDirectory()) {
    dirInput = argv.input;
  } else {
    console.error("Input path is Invalid!");
    process.exit(-1);
  }
}

if (argv.output) {
  if (fs.existsSync(argv.output) && fs.lstatSync(argv.output).isDirectory()) {
    dirOutput = argv.output;
  } else {
    console.error("Output path is Invalid!");
    process.exit(-1);
  }
}

if (argv.quality) {
  if (argv.quality >= 0 && argv.quality <= 100) {
    quality = Number(argv.quality);
  } else {
    console.error("Quality must be between 0 and 100!");
    process.exit(-1);
  }
}

if (argv.chunks) {
  if (argv.chunks >= 1) {
    chunks = Number(argv.chunks);
  } else {
    console.error("Chunks must be greater than 1!");
    process.exit(-1);
  }
}

const sliceIntoChunks = function(arr, chunkSize) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
  }
  return res;
};

const chunkConvert = function(files, output, quality) {
  return new Promise((chunkSuccess, fail) => {
    console.log(`Converting chunk with ${files.length} files...`);
    imagemin(files, {
      destination: output,
      plugins: [
        imageminWebp({
          quality
        })
      ],
    })
    .then((result) => {
      if (result?.length > 0) {
        console.log(` => Converted ${result?.length} files`)
      } else {
        console.log(` => No files are converted`)
      }
      console.log("---------------------------------\n")

      chunkSuccess(result);
    })
    .catch((e) => {
      console.error("Error during conversion:", e);
      chunkSuccess([]);
    });
  });
};

const convertFile = async (inputFile, outputFile, quality) => {
  const transformer = imageminWebp({ quality }).default();
  
  await pipelineAsync(
    fs.createReadStream(inputFile),
    transformer,
    fs.createWriteStream(outputFile)
  );
};

const convertDirectory = async (inputDir, outputDir, quality, chunks) => {
  const findFilter = `${inputDir}/*.{jpg,jpeg,png}`;
  glob(findFilter, {}, async (err, files) => {
    if (err) {
      console.error("Error reading files:", err);
      return;
    }

    if (chunks && chunks > 0) {
      const filesChunk = sliceIntoChunks(files, chunks);
      for (let i = 0; i < filesChunk.length; i++) {
        await chunkConvert(filesChunk[i], outputDir, quality);
      }
    } else {
      await chunkConvert(files, outputDir, quality);
    }
  });
};

try {
  convertDirectory(dirInput, dirOutput, quality, chunks);
} catch(e) {
  console.log(e);
  process.exit(-1);
}
