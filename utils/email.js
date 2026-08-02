const { Resend } = require('resend');

// Initialize the Resend HTTP client with your environment API key
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  // Free accounts without custom domains can send to their own registration emails using 'onboarding@resend.dev'
  const fromEmail = process.env.NODE_ENV === 'production' 
    ? 'Project Flow <onboarding@resend.dev>' 
    : 'Project Flow <onboarding@resend.dev>';

  // Execute a secure HTTPS POST request over port 443 (Allowed by Render)
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  });

  if (error) {
    throw new Error(`Resend HTTP API Error: ${error.message}`);
  }

  return data;
};

module.exports = sendEmail;