// Local-only Web Push sender for the AlJoud test.
// Keep vapid-private-key.txt and subscription.json on your computer. Never commit or upload them.
const fs = require('node:fs');
const webpush = require('web-push');

const required = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

const subscriptionPath = process.argv[2] || 'subscription.json';
if (!fs.existsSync(subscriptionPath)) {
  console.error(`Subscription file not found: ${subscriptionPath}`);
  process.exit(1);
}

let subscription;
try {
  subscription = JSON.parse(fs.readFileSync(subscriptionPath, 'utf8'));
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error('Subscription JSON must include endpoint and keys.p256dh/keys.auth.');
  }
} catch (error) {
  console.error('Could not read a valid subscription:', error.message);
  process.exit(1);
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

webpush.sendNotification(
  subscription,
  JSON.stringify({
    title: 'الجود كافيه ☕',
    body: 'نجح اختبار Web Push! وصل الإشعار عبر المسار المستقل.',
    url: 'https://7hasan.github.io/AlJoud_Coffee/'
  }),
  { TTL: 60 }
).then(() => {
  console.log('SUCCESS: Web Push notification sent to the test subscription.');
}).catch((error) => {
  console.error('SEND FAILED');
  console.error('Status code:', error.statusCode || 'unknown');
  console.error('Message:', error.body || error.message);
  process.exitCode = 1;
});
