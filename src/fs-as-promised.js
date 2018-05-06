import fs from 'fs'
import rm from 'rimraf'

export const readdir = (dir) => new Promise((resolve, reject) => {
  fs.readdir(dir, (err, files) => {
    if (err) return reject(err)
    resolve(files)
  })
})

export const stat = (file) => new Promise((resolve, reject) => {
  fs.stat(file, (err, stats) => {
    if (err) return reject(err)
    resolve(stats)
  })
})

export const rimraf = (dir) => new Promise((resolve, reject) => {
  rm(dir, (err) => {
    if (err) return reject(err)
    resolve()
  })
})
