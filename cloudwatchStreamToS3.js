'use strict';

const aws = require('aws-sdk');
const zlib = require('zlib');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });

// entry point
exports.handler = (event, context, callback) => {
  const payload = new Buffer(event.awslogs.data, 'base64');

  // converts the event to a valid JSON object with the sufficient infomation required
  function parseEvent(logEvent, logGroupName, logStreamName) {
    return {
      // remove '\n' character at the end of the event
      message: logEvent.message.substring(0, logEvent.message.length - 1),
      logGroupName,
      logStreamName,
      timestamp: new Date(logEvent.timestamp).toISOString(),
    };
  }

  function putEventsToS3(parsedEvents) {
    var finalEvent = parsedEvents.map(JSON.stringify).join('\n')
    var bucket = process.env.CLOUDWATCH_BUCKET;
    const folder = "CloudWatch";
    var objecttimestamp = new Date();
    var region = process.env.AWS_REGION;
    const prefix = "CloudWatchLogs_";
    var key = folder + '/' + region + '/' + objecttimestamp.getFullYear() + '/' + (objecttimestamp.getMonth() +1) + '/' + objecttimestamp.getDate() + '/' + prefix + new Date(objecttimestamp).toISOString() + 'json.gz';
    zlib.gzip(finalEvent, (err, result) => {
      if (err) {
        callback(err);
      } else {
        const binaryObject = result;
        var params = {
          Bucket: bucket,
          ContentType: "application/gzip",
          Key: key,
          Body: binaryObject,
        };
        s3.putObject(params, (err, data) => {
          if (err) {
            console.log(err);
            const message = `Error putting object ${key} to bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
            console.log(message);
            callback(message);
          } else {
            console.log('CONTENT TYPE:', data.ContentType);
            callback(null, data.ContentType);
          }
        });
      }
    });
  }
  zlib.gunzip(payload, (error, result) => {
    if (error) {
      callback(error);
    } else {
      const resultParsed = JSON.parse(result.toString('ascii'));
      const parsedEvents = resultParsed.logEvents.map((logEvent) =>
      parseEvent(logEvent, resultParsed.logGroup, resultParsed.logStream));

      putEventsToS3(parsedEvents);
    }
  });
};
