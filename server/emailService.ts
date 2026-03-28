import { Resend } from 'resend';

// Escape HTML to prevent XSS in emails
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableResendClient() {
  const { apiKey } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function sendWarGroupRegistrationEmail(
  registrationData: {
    name: string;
    city: string;
    state: string;
    contactEmail: string;
    contactPhone?: string;
    description?: string;
    meetingInfo?: string;
    leadershipExperience?: string;
    motivation?: string;
  },
  requesterEmail: string
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const emailHtml = `
      <h2>New War Group Registration Request</h2>
      <p>A new war group registration has been submitted:</p>
      
      <h3>Group Information</h3>
      <ul>
        <li><strong>Group Name:</strong> ${escapeHtml(registrationData.name)}</li>
        <li><strong>Location:</strong> ${escapeHtml(registrationData.city)}, ${escapeHtml(registrationData.state)}</li>
        <li><strong>Requester:</strong> ${escapeHtml(requesterEmail)}</li>
      </ul>
      
      <h3>Contact Information</h3>
      <ul>
        <li><strong>Email:</strong> ${escapeHtml(registrationData.contactEmail)}</li>
        ${registrationData.contactPhone ? `<li><strong>Phone:</strong> ${escapeHtml(registrationData.contactPhone)}</li>` : ''}
      </ul>
      
      ${registrationData.description ? `
      <h3>Description</h3>
      <p>${escapeHtml(registrationData.description)}</p>
      ` : ''}
      
      ${registrationData.meetingInfo ? `
      <h3>Meeting Information</h3>
      <p>${escapeHtml(registrationData.meetingInfo)}</p>
      ` : ''}
      
      ${registrationData.leadershipExperience ? `
      <h3>Leadership Experience</h3>
      <p>${escapeHtml(registrationData.leadershipExperience)}</p>
      ` : ''}
      
      ${registrationData.motivation ? `
      <h3>Motivation</h3>
      <p>${escapeHtml(registrationData.motivation)}</p>
      ` : ''}
      
      <p><a href="${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://manupgodsway.org'}/admin">Review in Admin Panel</a></p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: 'info@manupgodsway.org',
      subject: `New War Group Registration: ${registrationData.name}`,
      html: emailHtml,
    });

    console.log('War group registration email sent successfully');
  } catch (error) {
    console.error('Error sending war group registration email:', error);
    // Don't throw - we don't want to fail the registration if email fails
  }
}

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  'improvement': 'Improvement Suggestion',
  'feature-request': 'Feature Request',
  'bug-report': 'Bug Report',
  'compliment': 'Compliment',
  'complaint': 'Issue/Complaint',
  'general': 'General Feedback',
};

export async function sendFeedbackEmail(
  feedback: string,
  category: string,
  userEmail: string,
  userName: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();
  const categoryLabel = FEEDBACK_CATEGORY_LABELS[category] || category;

  const html = `
    <h2>Feedback Received</h2>
    <p><strong>From:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</p>
    <p><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>
    <h3>Message</h3>
    <p style="white-space: pre-wrap;">${escapeHtml(feedback)}</p>
  `;

  await client.emails.send({
    from: fromEmail,
    to: 'info@manupgodsway.org',
    subject: `Feedback - ${categoryLabel}`,
    html,
  });

  console.log(`Feedback email sent (category: ${categoryLabel})`);
}

export async function sendHelpRequestEmail(
  message: string,
  userEmail: string,
  userName: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();

  const html = `
    <h2>Help/Support Request</h2>
    <p><strong>From:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</p>
    <h3>Message</h3>
    <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
  `;

  await client.emails.send({
    from: fromEmail,
    to: 'info@manupgodsway.org',
    subject: 'Help/Support',
    html,
  });

  console.log(`Help request email sent from ${userEmail}`);
}
