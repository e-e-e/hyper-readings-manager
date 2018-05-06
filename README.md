# hyper-readings-manager

This is library to help manage multiple instances of [hyper-readings](https://github.com/sdockray/hyperreadings).

## Install

```sh
npm install hyper-readings-manager -save
```

## Usage

```js
const Manager = require('hyper-readings-manager')
const path = require('path')

const manager = new Manager('./path/to/folder'))

manager.on('ready', () => {
  manager.new('reading-list')
    .then(() => {
      console.log('working', manager.list())
    })
    .catch(e => console.log(e))
})

```

## API

#### `var manager = new Manager(folder)`

Start new manager instance. Folder is the directory where to read and store hyper-readings.

This will automatically import and share all hyper-reading databases within folder.

#### `var list = db.list()`

Returns an array of all managed hyper-readings.

In the form:
```js
{
  key: string // the db key
  hr: hyperreadings // the new hyper-readings instance
  folder: string // folder where the db is now stored
}
```

#### `db.new(name)`

Creates new hyper-reading database with managers base folder with the directory name: `[name].db`.

Returns promise which resolves to:
```js
{
  key: string // the db key
  hr: hyperreadings // the new hyper-readings instance
  folder: string // folder where the db is now stored
}
```

#### `db.import(key, [name])`

Imports hyper-reading with key into the managers base folder with the directory name: `[name].db`.

Returns promise which resolves to:
```js
{
  key: string // the db key
  hr: hyperreadings // the hyper-readings instance
  folder: string // folder where the db is now stored
}
```

#### `db.remove(key)`

Deletes database for hyper-reading with key.

Returns promise.

