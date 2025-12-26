// Mailchimp Integration Service
// Subscribes new users to the mailing list when they register

const MAILCHIMP_LIST_ID = "38327ef632";
const MAILCHIMP_DATA_CENTER = "us12";

interface MailchimpSubscribeData {
  email: string;
  firstName?: string;
  lastName?: string;
}

export async function subscribeToMailchimp(data: MailchimpSubscribeData): Promise<boolean> {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  
  if (!apiKey) {
    console.log("Mailchimp API key not configured - skipping subscription");
    return false;
  }

  try {
    const url = `https://${MAILCHIMP_DATA_CENTER}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: data.email,
        status: "subscribed",
        merge_fields: {
          FNAME: data.firstName || "",
          LNAME: data.lastName || "",
        },
      }),
    });

    if (response.ok) {
      console.log(`Successfully subscribed ${data.email} to Mailchimp`);
      return true;
    }

    // Handle "already subscribed" as success
    if (response.status === 400) {
      const errorData = await response.json();
      if (errorData.title === "Member Exists") {
        console.log(`${data.email} is already subscribed to Mailchimp`);
        return true;
      }
      console.error("Mailchimp subscription error:", errorData);
    } else {
      const errorText = await response.text();
      console.error("Mailchimp API error:", response.status, errorText);
    }

    return false;
  } catch (error) {
    console.error("Error subscribing to Mailchimp:", error);
    return false;
  }
}
