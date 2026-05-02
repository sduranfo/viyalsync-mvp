const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

exports.holaVitalSync = onRequest((request, response) => {
  logger.info("VitalSync esta vivo!", {structuredData: true});
  response.send("VitalSync MVP - Backend funcionando");
});