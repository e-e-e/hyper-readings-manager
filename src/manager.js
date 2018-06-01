import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { HyperReadings } from 'hyper-readings'
import swarm from 'hyperdiscovery'

import { readdir, stat, rimraf } from './fs-as-promised'
import networkSpeed from './hyperdb-network-speed'
import storageStats from './hyperdb-storage-stats'

const defaultHrOpts = { swarm }

function isDirectoryDB (dir) {
  return dir.match(/\.db$/)
}

function createHyperReadings (folder, key) {
  return new Promise((resolve, reject) => {
    console.log('opening', folder)
    const hr = HyperReadings(folder, key, defaultHrOpts)
    hr.on('ready', () => resolve(hr))
    hr.on('error', () => resolve(false))
  })
}

function isAuthorised (hr) {
  return new Promise((resolve, reject) => {
    const local = hr.graph.db.local
    if (!local) return resolve(false)
    try {
      hr.graph.db.authorized(local.key, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    } catch (e) {
      resolve(false)
    }
  })
}

async function getHyperReadingFolders (dir) {
  const validFolders = []
  console.log('tying', dir)
  const files = await readdir(dir)
  // console.log('tying', dir)
  for (const file of files) {
    if (!isDirectoryDB(file)) continue
    const resolved = path.join(dir, file)
    const s = await stat(resolved)
    // this is crude and treats any folder as a db
    // should check if folder also contains feed etc
    if (s.isDirectory()) validFolders.push({ path: resolved, creationTime: s.ctimeMs })
  }
  return validFolders
}

class Manager extends EventEmitter {
  constructor (folder) {
    super()
    const stat = fs.statSync(folder)
    if (!stat.isDirectory()) {
      this.emit('error', new Error(`Folder ${folder} does not exist`))
      return
    }
    this.dir = folder
    this.readinglists = {}
    console.log('loading')
    this._load()
      .then(() => this.emit('ready'))
      .catch((err) => this.emit('error', err))
  }

  /** load existing hyperreadings */
  async _load () {
    const folders = await getHyperReadingFolders(this.dir)
    console.log('folders', folders)
    return Promise.all(folders.map((folder) => this.openFolder(folder.path, null, folder.creationTime)))
  }

  async openFolder (folder, key, creationTime) {
    const hr = await createHyperReadings(folder, key)
    console.log('key key', hr.key())
    if (!key) {
      key = hr.key()
    }
    if (this.readinglists[key]) {
      console.log(key, 'is already loaded')
      return this.readinglists[key]
    }
    console.log('created reading list with key', key)
    console.log('join network')
    hr.joinNetwork({ live: false })
    hr.network.on('connection', function (peer, type) {
      // console.log('got', peer, type)
      console.log('connected to', hr.network.connections.length, 'peers')
      peer.on('close', function () {
        console.log('peer disconnected')
      })
    })

    const authorised = await isAuthorised(hr)
    const title = await hr.title()

    const watcher = hr.graph.db.watch('@version', async () => {
      console.log('changed title')
      this.readinglists[key].title = await hr.title()
    })

    this.readinglists[key] = {
      watcher,
      key,
      hr,
      authorised,
      title,
      folder,
      speed: networkSpeed(hr.graph.db),
      size: storageStats(hr.graph.db),
      creationTime: creationTime || Date.now()
    }
    return this.readinglists[key]
  }

  async new (name) {
    console.log('making new', name)
    const folder = path.join(this.dir, `${name}.db`)
    const hrInfo = await this.openFolder(folder)
    await hrInfo.hr.setTitle(name)
    hrInfo.title = name
    return hrInfo
  }

  async import (key) {
    if (!key) throw new Error('Requires Key to import hyper-reading')
    if (this.readinglists[key]) return this.readinglists[key]
    const folder = path.join(this.dir, `${key}.db`)
    console.log('importing', key)
    const hrInfo = await this.openFolder(folder, key)
    return hrInfo
  }

  stats () {
    const keys = Object.keys(this.readinglists)
    if (!keys) return {}
    return keys.reduce((p, key) => {
      const hr = this.get(key)
      // this will count peers that may be the same across multiple hrs
      // TODO: fix this to remove duplicate connections
      p.peers += hr.hr.network.connections.length
      p.download += hr.speed.downloadSpeed
      p.upload += hr.speed.uploadSpeed
      return p
    }, { peers: 0, download: 0, upload: 0 })
  }

  async importFile (file) {
    throw Error('Needs to be implemented')
  }

  async fork () {
    throw Error('Needs to be implemented')
  }

  async remove (key) {
    const readinglist = this.readinglists[key]
    readinglist.watcher.destroy()
    if (!readinglist) {
      console.log(key, 'does not exist!')
      return
    }
    if (readinglist.hr.network) {
      await readinglist.hr.leaveNetwork()
    }
    const folder = readinglist.folder
    // confirm that folder is .db before recursive deletion
    if (!isDirectoryDB(folder)) {
      throw Error('Folder is not a valid db')
    }
    delete this.readinglists[key].hr
    delete this.readinglists[key]
    return rimraf(folder)
  }

  get (key) {
    return this.readinglists[key]
  }

  _sortDate (a, b) {
    const _a = this.readinglists[a].creationTime
    const _b = this.readinglists[b].creationTime
    if (_a > _b) return -1
    if (_a < _b) return 1
    return 0
  }

  list () {
    // get basic information about the current hrs
    const lists = Object.keys(this.readinglists)
    lists.sort(this._sortDate.bind(this))
    return lists.map(key => this.readinglists[key])
  }

  activeLists () {
    const lists = Object.keys(this.readinglists)
    return lists.map((key) => {
      if (this.readinglists[key].size.totalPercentage !== 100) {
        return null
      }
      return {
        title: this.readinglists[key].title,
        key
      }
    }).filter(v => !!v)
  }
}

export default Manager
