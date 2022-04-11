import imagemin from 'imagemin'
import imageminWebp from 'imagemin-webp'
import path from 'path'
import fs from 'fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import glob from 'glob'

let dirInput = path.resolve(process.cwd()) + path.sep + 'input'
let dirOutput =  path.resolve(process.cwd()) + path.sep + 'output'
let quality = 100
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
  .argv

if (argv.input) {
  if (fs.existsSync(argv.input) && fs.lstatSync(argv.input).isDirectory()) {
    dirInput = argv.input
  } else {
    console.error("Input path is Invalid!")
    process.exit(-1)
  }
}

if (argv.output) {
  if (fs.existsSync(argv.output) && fs.lstatSync(argv.output).isDirectory()) {
    dirOutput = argv.output
  } else {
    console.error("Output path is Invalid!")
    process.exit(-1)
  }
}

if (argv.quality) {
  if (argv.quality >= 0 && argv.quality <= 100) {
    quality = Number(argv.quality)
  } else {
    console.error("Quality must be between 0 and 100!")
    process.exit(-1)
  }
}

if (argv.chunks) {
  if (argv.chunks >= 1) {
    chunks = Number(argv.chunks)
  } else {
    console.error("Chunks must be greater than 1!")
    process.exit(-1)
  }
}

const sliceIntoChunks = function(arr, chunkSize) {
  const res = []
  for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize)
      res.push(chunk)
  }
  return res
}

const convert = function(input, output, quality, formats, chunks) {
  input = input || './input'
  output = output || './output'
  formats = formats || ['jpg', 'jpeg', 'png', 'tiff', 'tif']
  quality = quality || 100
  chunks = chunks || false

  const chunkConvert = function(files, output, quality) {
    return new Promise((chunkSuccess, fail) => {
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

        chunkSuccess(result)
      })
      .catch((e) => chunkSuccess([]))
    })
  }

  return new Promise((success, fail) => {
    console.log(input, "\n")

    const findFilter = `${input}/*.{${formats.join(',')}}`

    if (chunks && chunks > 0) {
      glob(findFilter, {}, async function (er, files) {

        const filesChunk = sliceIntoChunks(files, chunks)
        const count = filesChunk.length - 1

        for (let i = 0; i <= count; i++) {
          try {
            let result = await chunkConvert(filesChunk[i], output, quality)
            success(result)
          } catch (e) {
            success([])
          }
        }
      })
    } else {
      chunkConvert([findFilter], output, quality).then((result) => {
        success(result)
      })
    }
  })
}

const convertByDirectory = function(dirInput, dirOutput, folders) {
  folders = folders || []
  const subfolder = folders?.length > 0 ? (path.sep + folders.join(path.sep)) : ''
  const input = fs.readdirSync(path.normalize(dirInput + subfolder))

  input.forEach(async function(file) {
    const source = dirInput + subfolder + path.sep + file

    if (fs.statSync(source).isDirectory()) {
      const dest = dirOutput + subfolder + path.sep + file

      try {
        await convert(source, dest, quality, chunks)
        convertByDirectory(dirInput, dirOutput, [...folders, file])
      } catch (e) {
        console.error("ERROR", source, e)
      }
    }
  })
}

try {
  convertByDirectory(dirInput, dirOutput)
} catch(e) {
  console.log(e)
  process.exit(-1)
}
