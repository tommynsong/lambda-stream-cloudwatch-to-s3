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
    const finalEvent = parsedEvents.map(JSON.stringify).join('\n');
    const bucket = "704710118823-aa4aws-cloudwatch";
    const folder = "CloudWatch";
    var objecttimestamp = new Date();
    const prefix = "CloudWatchLogs_";
    var key = folder + '/' + objecttimestamp.getFullYear() + '/' + (objecttimestamp.getMonth() +1) + '/' + objecttimestamp.getDate() + '/' + prefix + objecttimestamp + '.log';
    var params = {
      Bucket: bucket,
      Key: key,
      Body: finalEvent,
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
