'use strict';

const aws = require('aws-sdk');
const zlib = require('zlib');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
var _ = require('lodash');

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
    //console.log('PARSED EVENTS: ', parsedEvents);
    var finalEvent = parsedEvents.map(JSON.stringify).join('\n');
    //console.log('FINAL EVENTS: ', finalEvent);
    var bucket = process.env.CLOUDWATCH_BUCKET;
    const folder = "CloudWatch";
    var objecttimestamp = new Date();
    var region = process.env.AWS_REGION;
    const prefix = "CloudWatchLogs_";
    var awsAccountId = context.invokedFunctionArn.split(':')[4];
    var records = {
      "Records": parsedEvents
    };
    var body = JSON.stringify(records);
    //console.log('RECORDS: ', records);
    //console.log('STRINGIFY:', body);
    var key = "AWSLogs" + '/' + awsAccountId + '/' + folder + '/' + region + '/' + objecttimestamp.getFullYear() + '/' + (objecttimestamp.getMonth() +1) + '/' + objecttimestamp.getDate() + '/' + prefix + objecttimestamp.toISOString().replace(/-/g,'').replace(/:/g,'') + '.json.gz';
    zlib.gzip(JSON.stringify(records), function(err, result) {
      if (err) {
        callback(err);
      } else {
        const binary = result;
        var params = {
          Bucket: bucket,
          ContentType: "application/gzip",
          Key: key,
          ServerSideEncryption: "AES256",
          Body: binary,
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
