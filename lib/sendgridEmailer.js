// sendgridEmailer.js:

"use strict";

/**
 * SendGridEmailer - Email service using the SendGrid API.
 * Extends BaseEmailer, which itself extends BaseService.
 */

const { BaseEmailer } = require("zyx-base");
const Schema = require("zyx-schema");
const system = require("zyx-system");
const sgMail = require("@sendgrid/mail");

const { stringType } = Schema.types;

/**
 * Email sender class using the SendGrid API.
 *
 * @extends BaseEmailer
 */
class SendGridEmailer extends BaseEmailer {
  /**
   * Validates SendGrid-specific configuration.
   *
   * @override
   * @throws {Error} If configuration is invalid.
   */
  verifyConfig() {
    const { errors } = new Schema({
      sendgrid_api_key: stringType({ min: 10, required: true }),
    }).validate(this.config);

    if (errors.length > 0) {
      const message = errors.map(e => e.message).join(", ");
      system.log?.error?.(`SendGrid config validation failed: ${message}`);
      throw new Error("SendGrid config invalid: " + message);
    }
  }

  /**
   * Initializes the SendGrid client with API key.
   * SendGrid does not maintain a persistent connection.
   *
   * @override
   * @returns {Promise<void>}
   */
  async connect() {
    const { sendgrid_api_key } = this.config;

    try {
      sgMail.setApiKey(sendgrid_api_key);
      this.setConnection(sgMail); // Treat sgMail as the "connection"
    } catch (err) {
      system.log?.error?.("Failed to initialize SendGrid client.");
      throw new Error(
        "Unable to initialize SendGrid connection: " + err.message
      );
    }
  }

  /**
   * SendGrid uses a stateless HTTP API, so there's nothing to disconnect.
   *
   * @override
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.setConnection(undefined);
  }

  /**
   * SendGrid does not use traditional SMTP transports.
   * This is required for compatibility but delegates to `connect()`.
   *
   * @override
   * @returns {Promise<void>}
   */
  async createTransport() {
    await this.connect(); // No separate transport creation in SendGrid
  }

  /**
   * Sends an email using the SendGrid API.
   * Composes the message using BaseEmailer helpers.
   *
   * @override
   * @param {object} [data={}] - Template context for the email.
   * @returns {Promise<object>} SendGrid response.
   * @throws {Error} If the send fails.
   */
  async send(data = {}) {
    if (!this.connection) {
      await this.connect();
    }

    const msg = await this.buildMessageObject(data);

    try {
      const response = await this.connection.send(msg);
      return response;
    } catch (err) {
      const details = err?.response?.body?.errors
        ?.map(e => e.message)
        .join(", ");
      system.log?.error?.("SendGrid email failed:", details || err.message);
      throw new Error("SendGrid send failed: " + (details || err.message));
    }
  }
}

module.exports = SendGridEmailer;
