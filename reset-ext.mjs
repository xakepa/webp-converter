import path from 'path'
import fs from 'fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import glob from 'glob'

let dirInput = path.resolve(process.cwd()) + path.sep + 'input'
let dirOutput =  path.resolve(process.cwd()) + path.sep + 'output'

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

const rename = function(input, output) {
  input = path.normalize(input || './input')
  output = path.normalize(output || './output')
  let formats = ['jpg', 'jpeg', 'png', 'tiff', 'tif']

  return new Promise((success, fail) => {
    let file = null
    let ext = null
    let srcFilePath = null
    let destFilePath = null

    glob(`${input}/*.{${formats.join(',')}}`, {}, async function (er, files) {
      files.forEach(current => {
        ext = path.extname(current)
        file = path.basename(current, ext)

        srcFilePath = path.normalize(output + path.sep + file + '.webp')
        destFilePath = path.normalize(output + path.sep + file + ext)

        if (fs.existsSync(srcFilePath)) {
          fs.renameSync(srcFilePath, destFilePath)
        }
      })

      success(files)
    })
  })
}

const treeSearch = function(dirInput, dirOutput, folders) {
  folders = folders || []
  const subfolder = folders?.length > 0 ? (path.sep + folders.join(path.sep)) : ''
  const input = fs.readdirSync(path.normalize(dirInput + subfolder))

  input.forEach(async function(file) {
    const source = dirInput + subfolder + path.sep + file

    if (fs.statSync(source).isDirectory()) {
      const dest = dirOutput + subfolder + path.sep + file

      try {
        await rename(source, dest)
        treeSearch(dirInput, dirOutput, [...folders, file])
      } catch (e) {
        console.error("ERROR", source, e)
      }
    }
  })
}

try {
  treeSearch(dirInput, dirOutput)
} catch(e) {
  console.log(e)
  process.exit(-1)
}
