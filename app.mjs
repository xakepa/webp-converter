import imagemin from 'imagemin'
import imageminWebp from 'imagemin-webp'
import path from 'path'
import fs from 'fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

let dirInput = path.resolve(process.cwd()) + path.sep + 'input'
let dirOutput =  path.resolve(process.cwd()) + path.sep + 'output'
let quality = 100

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
    console.error("Quality must be between 0 and 100.")
    process.exit(-1)
  }
}

const convert = function(input, output, quality, formats) {
  input = input || './input'
  output = output || './output'
  formats = formats || ['jpg', 'jpeg', 'png', 'tiff', 'tif']
  quality = quality || 100

  return new Promise((success, fail) => {
    console.log(input, "\n")

    imagemin([`${input}/*.{${formats.join(',')}}`], {
      destination: output,
      plugins: [
        imageminWebp({
          quality
        })
      ],
    }).then((result) => {
      if (result?.length > 0) {
        console.log(` => Converted ${result?.length} files`)
      } else {
        console.log(` => No files are converted`)
      }
      console.log("\n")
  
      success(result)
    })
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
        await convert(source, dest, quality);
        convertByDirectory(dirInput, dirOutput, [...folders, file])
      } catch (e) {
        console.error("ERROR", source, e);
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
