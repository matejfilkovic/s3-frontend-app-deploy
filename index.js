const path = require('path')
const fs = require('fs')
const AWS = require('aws-sdk')
const mime = require('mime')

const { BUCKET_NAME, BUILD_PATH } = process.env

/**
 * AWS will pick AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment
 * variables. This AWS user has to have a policy for a bucket selected with
 * BUCKET_NAME variable. The policy must contain the following actions:
 *   - S3 object actions:
 *        "s3:PutObject",
 *        "s3:GetObject",
 *        "s3:DeleteObjectVersion",
 *        "s3:DeleteObject",
 *        "s3:PutObjectAcl"
 *
 *   - S3 bucket actions:
 *        "s3:PutLifecycleConfiguration",
 *        "s3:ListBucket"
 */

const s3 = new AWS.S3({
  params: { Bucket: BUCKET_NAME }
})

const deleteObject = (key) => {
  return new Promise((resolve, reject) => {
    s3.deleteObject({ Key: key }, (error) => {
      if (error) return reject(error)

      resolve()
    })
  })
}

const uploadFile = (fileName) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(BUILD_PATH, fileName)

    const body = fs.readFileSync(filePath)

    const params = {
      Key: fileName,
      Body: body,
      ACL: 'public-read',
      ContentType: mime.lookup(fileName)
    }

    // If object is html file, don't allow
    // caching.
    if (fileName.includes('.html')) {
      params.CacheControl = 'no-cache'
    }

    s3.putObject(params, (error) => {
      if (error) return reject(error)

      console.log(`${fileName} uploaded!`)
      resolve()
    })
  })
}

const clearBucket = () => {
  return new Promise((resolve, reject) => {
    s3.listObjects({}, (error, data) => {
      if (error) {
        return reject(error)
      }


      Promise.all(data.Contents.map(object => (
        deleteObject(object.Key)
      )))
        .then(() => resolve())
        .catch(reason => reject(reason))
    })
  })
}

const deployFiles = () => {
  const fileNames = fs.readdirSync(BUILD_PATH)

  return Promise.all(fileNames.map(fileName => (
    uploadFile(fileName)
  )))
}

console.log('Clearing bucket!')
clearBucket()
  .then(() => {
    console.log('Bucket cleared! Uploading files!')
    return (
      deployFiles()
    )
  })
  .then(() => {
    console.log('All files uploaded!')
  })
  .catch(error => console.log(error))
