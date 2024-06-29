import path from 'path';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import glob from 'glob';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import { pipeline } from 'stream';
import { promisify } from 'util';
import readline from 'readline';

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

if (argv.chunks) {
  if (argv.chunks >= 1) {
    chunks = Number(argv.chunks);
  } else {
    console.error("Chunks must be greater than 1!");
    process.exit(-1);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Choose quality (20-100): ', (inputQuality) => {
  const qualityValue = Number(inputQuality);

  if (isNaN(qualityValue) || qualityValue < 20 || qualityValue > 100) {
    console.error("Quality must be a number between 20 and 100!");
    rl.close();
    process.exit(-1);
  } else {
    quality = qualityValue;
    rl.close();
    startConversion();
  }
});

const sliceIntoChunks = function(arr, chunkSize) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
};

const chunkConvert = async function(files, output, quality) {
  console.log(`Converting chunk with ${files.length} files...`);
  for (let i = 0; i < files.length; i++) {
    try {
      console.log(`Converting file ${i + 1}...`);
      const result = await imagemin([files[i]], {
        destination: output,
        plugins: [
          imageminWebp({
            quality
          })
        ]
      });
      if (result?.length > 0) {
        console.log(` => Converted ${files[i]}`);
      } else {
        console.log(` => No files are converted for ${files[i]}`);
      }
    } catch (e) {
      console.error(`Error during conversion of ${files[i]}:`, e);
    }
  }
  console.log("---------------------------------\n");
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

const startConversion = () => {
  try {
    convertDirectory(dirInput, dirOutput, quality, chunks);
  } catch(e) {
    console.log(e);
    process.exit(-1);
  }
};
