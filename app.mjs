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
    console.error("Input folder is invalid!");
    process.exit(-1);
  }
}

if (argv.output) {
  if (fs.existsSync(argv.output) && fs.lstatSync(argv.output).isDirectory()) {
    dirOutput = argv.output;
  } else {
    console.error("Output folder is invalid");
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

const promptQuality = () => {
  rl.question('Choose quality percentage (20-100): ', (inputQuality) => {
    let qualityValue = Number(inputQuality);

    if (isNaN(qualityValue) || qualityValue < 20 || qualityValue > 100) {
      console.error("\x1b[31mQuality must be a number between 20 and 100!\x1b[0m");
      promptQuality();
    } else {
      quality = qualityValue;
      rl.close();
      startConversion();
    }
  });
};

promptQuality();

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
        const currentFile = path.basename(files[i]);
        console.log(` => ${currentFile} \x1b[32msuccessfully converted!\x1b[0m`);
      } else {
        console.log(` => Files not converted ${files[i]}`);
      }
    } catch (e) {
      console.error(`Error during conversion of ${files[i]}:`, e);
    }
  }
  console.log("---------------------------------\n");
};

const convertDirectory = async (inputDir, outputDir, quality, chunks) => {
  const findFilter = `${inputDir}/*.{jpg,jpeg,png,JPG,JPEG,PNG}`;
  glob(findFilter, {}, async (err, files) => {
    if (err) {
      console.error("Error reading files:", err);
      return;
    }

    if (!files.length) {
      console.log(`\x1b[31mNo files found with extension .jpg, .jpeg, or .png in folder ${inputDir}\x1b[0m`);
      return;
    }
  
    console.log(`\x1b[32mFound ${files.length} files for conversion:\x1b[0m`);

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
