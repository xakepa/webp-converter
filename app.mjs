import path from 'path';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import glob from 'glob';
import sharp from 'sharp';
import { promisify } from 'util';
import readline from 'readline';

const globAsync = promisify(glob);

let dirInput = path.resolve(process.cwd()) + path.sep + 'input';
let dirOutput = path.resolve(process.cwd()) + path.sep + 'output';
let quality = 100;
let chunks = false;
let resizeWidth;

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
  .option('width', {
    alias: 'w',
    description: 'Resize output width (keeps aspect ratio)',
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

if (argv.width !== undefined) {
  const widthValue = Number(argv.width);
  if (isNaN(widthValue) || widthValue < 1) {
    console.error("Width must be a positive number!");
    process.exit(-1);
  }
  resizeWidth = Math.floor(widthValue);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const promptWidth = () => {
  rl.question('Enter target width in px (press Enter to keep original): ', (inputWidth) => {
    const trimmed = inputWidth.trim();
    if (trimmed === '') {
      rl.close();
      startConversion();
      return;
    }

    const widthValue = Number(trimmed);
    if (isNaN(widthValue) || widthValue < 1) {
      console.error("Width must be a positive number!");
      promptWidth();
      return;
    }

    resizeWidth = Math.floor(widthValue);
    rl.close();
    startConversion();
  });
};

const promptQuality = () => {
  rl.question('Choose quality percentage (20-100): ', (inputQuality) => {
    let qualityValue = Number(inputQuality);

    if (isNaN(qualityValue) || qualityValue < 20 || qualityValue > 100) {
      console.error("\x1b[31mQuality must be a number between 20 and 100!\x1b[0m");
      promptQuality();
    } else {
      quality = qualityValue;
      if (resizeWidth === undefined) {
        promptWidth();
      } else {
        rl.close();
        startConversion();
      }
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

const ensureOutputDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const convertFile = async (filePath, outputDir, qualityValue, widthValue) => {
  const { name } = path.parse(filePath);
  const destination = path.join(outputDir, `${name}.webp`);

  let image = sharp(filePath);

  if (widthValue) {
    image = image.resize({
      width: widthValue,
      withoutEnlargement: true
    });
  }

  await image.webp({ 
    quality: qualityValue,
    effort: 6,
    smartSubsample: true

   }).toFile(destination);
  return destination;
};

const chunkConvert = async function(files, output, qualityValue, widthValue) {
  console.log(`Converting chunk with ${files.length} files...`);

  const promises = files.map(async (file, i) => {
    const currentFile = path.basename(file);
    try {
      await convertFile(file, output, qualityValue, widthValue);
      const resizeInfo = widthValue ? ` at width ${widthValue}px` : '';
      console.log(` => ${currentFile}${resizeInfo} \x1b[32msuccessfully converted!\x1b[0m`);
    } catch (e) {
      console.error(`Error during conversion of ${file}:`, e);
    }
  });

  await Promise.all(promises);
  
  console.log("---------------------------------\n");
};

const convertDirectory = async (inputDir, outputDir, qualityValue, chunkSize, widthValue) => {
  const findFilter = `${inputDir}/*.{jpg,jpeg,png,JPG,JPEG,PNG}`;

  try {
    const files = await globAsync(findFilter);

    if (!files.length) {
      console.log(`\x1b[31mNo files found with extension .jpg, .jpeg, or .png in folder ${inputDir}\x1b[0m`);
      return;
    }

    ensureOutputDir(outputDir);
    console.log(`\x1b[32mFound ${files.length} files for conversion:\x1b[0m`);

    if (chunkSize && chunkSize > 0) {
      const filesChunk = sliceIntoChunks(files, chunkSize);
      for (let i = 0; i < filesChunk.length; i++) {
        await chunkConvert(filesChunk[i], outputDir, qualityValue, widthValue);
      }
    } else {
      await chunkConvert(files, outputDir, qualityValue, widthValue);
    }
  } catch (err) {
    console.error("Error reading files:", err);
  }
};

const startConversion = async () => {
  try {
    await convertDirectory(dirInput, dirOutput, quality, chunks, resizeWidth);
  } catch(e) {
    console.log(e);
    process.exit(-1);
  }
};
