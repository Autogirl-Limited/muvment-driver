/** The icons the legal screens use; the screen maps each name to a drawing. */
export type LegalIcon = "banknote" | "checklist" | "invoice" | "locationFill" | "lockFill" | "personCheck" | "privacy" | "shieldCheck" | "warning";

export interface LegalDocument {
  /** Full legal text. Numbered lines ("1. Title", "2.1 Title") become headings; "- " lines become bullets. */
  body: string;
  title: string;
  /** Shown in the navigation bar once the big title scrolls away. */
  shortTitle: string;
  /** One or two plain sentences under the title. */
  intro: string;
  icon: LegalIcon;
  tint: string;
  details: { label: string; value: string }[];
  /** Plain-language key points. Must not add anything the full text does not say. */
  summary: { icon: LegalIcon; tint: string; title: string; body: string }[];
  /** Closing line under the document. */
  agreement: string;
}

export const privacyPolicyDocument: LegalDocument = {
  body: `Muvment Driver Privacy Policy
Operated by Autogirl Limited | muvment.ng
Last updated: November 17, 2026

1. About this policy
This policy explains how Autogirl Limited, which operates Muvment ("Muvment", "we", "us", or "our"), collects, uses, shares, and protects personal information about you as a driver using the Muvment driver app. It applies to the app and to the records we create through it.
Muvment is the controller of your personal information for the purposes of the Nigeria Data Protection Act 2023 ("NDPA"). This policy sits alongside your engagement agreement, the driver handbook, and the Muvment driver Terms of Use. Customers who book with Muvment are covered by a separate customer privacy policy.

2. Information we collect
2.1 Information you or Muvment provide
- Account details: your name, phone number, email address, and the login details for the account our operations team creates for you.
- Profile and engagement details: your driver status, the vehicle assigned to you, and other records connected with your engagement with Muvment.
- Bank details: the bank account you add so that approved payments can be made to you.
- Messages: what you send to our operations or support teams, including problem reports.
2.2 Information created while you work
- Trip records: the trips assigned to you, their status, start and end times, and trip history.
- Inspection records: the pre-ride and post-ride checklists you complete, including vehicle photos, odometer readings, fuel levels, and any notes.
- Driver selfies: the photo you take at the start of a trip so we can confirm who is operating the vehicle.
- Work hours and payment requests: the time you work, any extra hours, and the payment or allowance requests you submit, including receipts and their review status.
2.3 Location information
- Live location: while you are signed in to the app, it collects your device's precise location, including when the app is closed or in the background. This includes your position, direction, speed, and the accuracy of each reading.
- Photo location: the location where each inspection photo is taken is recorded with that photo.
- How location sharing works is explained in section 3.
2.4 Information from your device
- Device and app details: your device type, operating system, app version, and the notification token used to send you alerts.
- Permissions: whether you have allowed camera, location, and notification access, so the app can tell you when something it needs is turned off.
- Diagnostics: technical information about errors and connection problems, used to keep the app working.
2.5 Information from others
- Muvment staff and administrators: trip assignments, review decisions on your requests, and operational notes.
- Customers: feedback or complaints about a trip you drove.

3. How location sharing works
Location is central to how the app works, so we want to be clear about it.
- While you are signed in, the app shares your location with Muvment, including in the background. On Android, a notification is shown while this is happening.
- During an active trip, your live location is shown to the passenger on their trip map so they can follow their ride.
- If you lose your connection, the app keeps your most recent readings on your phone and sends them when you are back online.
- To stop location sharing, sign out of the app. You can also turn off location access in your phone's settings, but you may not be able to receive or complete trips without it.

4. How we use your information
We use your information to:
- Create and manage your driver account.
- Assign trips to you, guide you to pickups, and show passengers where their driver is.
- Record the condition of each vehicle at every handover, and resolve damage or other disputes.
- Confirm who is driving a vehicle, and keep drivers, passengers, and vehicles safe.
- Track work hours, review payment and allowance requests, and pay you.
- Send you trip alerts, updates, and other service messages.
- Apply the driver handbook, the Terms of Use, and your engagement agreement, including investigating complaints and incidents.
- Fix problems, keep the app secure, and improve how it works.
- Meet our legal, tax, insurance, and regulatory obligations.

5. Automated checks on photos
When you upload an inspection photo, our systems analyse it automatically to help read odometer and fuel gauges, spot visible damage, and check that the photo is clear and complete. The results are added to the inspection record and help our operations team review the condition of the vehicle.
Under the NDPA, you have the right not to be subject to a decision based solely on automated processing that significantly affects you. If you disagree with an automated result, contact us and we will review it.

6. The legal grounds we rely on
Under the NDPA, we process your personal information on one or more of these grounds:
- Contract: to manage your engagement with Muvment, assign trips, and pay you.
- Legitimate interests: to run a safe and reliable service, protect vehicles and customers, prevent fraud, and resolve disputes, so long as your rights do not override those interests.
- Legal obligation: to comply with laws that apply to us, such as tax and employment requirements, and lawful requests from authorities.
- Consent: where the law requires it, for example for background location access on your device. You can withdraw consent at any time, though some features may stop working.

7. Who can see your information
We do not sell your personal information. We share it only as needed to run the service:
- Passengers: during a trip, the details that identify you as their driver, such as your name and the vehicle details, and your live location.
- Muvment staff: our operations, support, and finance teams, who need it to manage trips, inspections, and payments.
- Service providers: companies that help us operate, such as hosting, maps and routing (including Google Maps), push notifications and app updates (Expo), and image analysis, acting on our instructions.
- Banks and payment providers: to make approved payments to you.
- Insurers and advisers: where needed for claims, audits, or legal advice.
- Authorities: where we are required by law, or where it is necessary to protect the rights, safety, or property of Muvment, drivers, customers, or the public.
- Business transfers: in connection with a merger, acquisition, or sale of assets, subject to this policy.

8. International transfers
Some of our service providers store or process information outside Nigeria. Where we transfer personal information across borders, we take steps to protect it in line with the NDPA, for example by using providers that offer an adequate level of protection or appropriate safeguards.

9. Information stored on your phone
To keep working without a connection, the app saves some information on your device, such as your sign-in session, recent trips and account details, and location readings waiting to be sent. Your sign-in details are kept in your phone's secure storage. Signing out removes your session from the device.

10. How long we keep your information
We keep personal information only for as long as we need it for the purposes in this policy. Trip, inspection, and payment records are kept for as long as needed to run the service, resolve disputes and claims, and meet our legal, tax, and accounting obligations, including after your engagement with Muvment ends. When we no longer need information, we delete it or make it anonymous.

11. How we protect your information
We use reasonable technical and organisational measures to protect your information, including encrypted connections, access controls, secure storage of sign-in details, and limiting access to staff who need it. No method of transmission or storage is completely secure, so we cannot guarantee absolute security, but we work to protect your information and to respond appropriately if a problem occurs.

12. Your rights
Subject to the NDPA and other applicable law, you have the right to:
- Be told how we use your personal information, as set out in this policy.
- Access the personal information we hold about you.
- Ask us to correct information that is wrong or incomplete.
- Ask us to delete your information, or your account, where the law allows. Some records must be kept, as explained in section 10.
- Object to or ask us to restrict certain processing.
- Withdraw consent where we rely on it.
- Ask for a copy of certain information in a portable format.
- Not be subject to a decision based solely on automated processing that significantly affects you.
- Lodge a complaint with the Nigeria Data Protection Commission.
To exercise any of these rights, contact us at info@muvment.ng. We may need to confirm your identity first, and we will respond within the time required by law.

13. Your choices
- Location: sign out to stop location sharing, or change location access in your phone's settings.
- Camera: you can turn off camera access in your phone's settings, but you will not be able to complete inspections without it.
- Notifications: you can turn trip alerts on or off in the app's settings or your phone's settings.
- Your details: your name, contact details, and bank details are managed by Muvment. Contact the operations team to correct them.

14. Changes to this policy
We may update this policy as the app, our practices, or the law change. When we make material changes, we will update the date at the top and, where appropriate, notify you in the app. If you continue to use the app after an update, the revised policy will apply.

15. Contact us
Autogirl Limited (Muvment)
Email: info@muvment.ng
Address: 10 Anuoluwapo Close, Opebi, Ikeja, Lagos
Phone: +234 816 747 4165`,
  title: "Driver Privacy Policy",
  shortTitle: "Privacy Policy",
  intro: "What Muvment collects about you as a driver, including your location and inspection photos, why we need it, and the rights you have over it.",
  icon: "privacy",
  tint: "#5856D6",
  details: [
    { label: "Last updated", value: "November 17, 2026" },
    { label: "Issued by", value: "Autogirl Limited" },
    { label: "Applies to", value: "Muvment drivers" },
    { label: "Regulated under", value: "NDPA 2023" },
  ],
  summary: [
    {
      icon: "locationFill",
      tint: "#007AFF",
      title: "Location is shared while you're signed in",
      body: "Including in the background. Passengers see your live location during their trip. Sign out to stop sharing.",
    },
    {
      icon: "checklist",
      tint: "#34C759",
      title: "Your photos are the inspection record",
      body: "Vehicle photos and selfies are tagged with their location and checked automatically. You can ask us to review any result.",
    },
    {
      icon: "shieldCheck",
      tint: "#FF9500",
      title: "We never sell your data",
      body: "We share it only to run the service, such as with passengers during a trip, our service providers, and banks that pay you.",
    },
    {
      icon: "personCheck",
      tint: "#5856D6",
      title: "You stay in control",
      body: "You can ask to access, correct, delete or export your data, and complain to the Nigeria Data Protection Commission.",
    },
  ],
  agreement:
    "This policy is issued under the Nigeria Data Protection Act 2023. To exercise your rights or ask a question, email info@muvment.ng.",
};

export const termsOfUseDocument: LegalDocument = {
  body: `Employee Terms of Use
Last updated: August 2026

1. Acceptance of these terms
The Muvment driver app is part of Muvment, operated by Autogirl Limited ("Muvment", "we", "us"). By logging in and using the app, you agree to these terms of service and to the driver handbook. If you do not agree, do not use the app. These terms are in addition to, and do not replace, your employment or engagement agreement with Muvment.

2. Eligibility
- You must be at least 18 years old.
- You must hold a valid driver license and any permits required to operate the assigned vehicle.
- You must be engaged by Muvment as a professional driver and have an account created for you by the operations team.
- You must use a device that meets the app requirements (iOS 14 or later, or Android 10 or later).

3. Your account
- Driver accounts are created by the Muvment operations team. There is no self-registration.
- Your account is personal to you. Keep your login details secure and do not share them or let anyone else use your account.
- You are responsible for activity that happens under your account. Tell us immediately if you believe your account has been accessed without permission.
- Your name, contact details, and bank details are managed by Muvment and shown in the app as read-only. Contact the operations team to correct them.

4. What the app is
The app is a work tool that manages the trip lifecycle from assignment to completion. It lets you view assigned trips, complete guided pre-ride and post-ride vehicle inspections, navigate to pickups, track your work hours, submit payment requests, and view your trip history. Trips are assigned to you through the Muvment admin panel. You cannot self-assign, bid for, or reject trips through the app.

5. Trips and checklists
- Complete the pre-ride checklist honestly and in full before starting a trip, including all required vehicle photos, the odometer reading, and the fuel level.
- Capture your driver selfie as required so we can confirm who is operating the vehicle.
- Start a ride only at or after the scheduled pickup time, and end it accurately when the trip is complete.
- Complete the post-ride checklist at handover so the condition of the vehicle is properly recorded.
- The information and photos you submit form the official record of each trip and vehicle handover. Submitting false or misleading records is a serious breach of these terms.

6. Driver conduct
As a Muvment driver you represent the brand and are held to our standard of discretion, safety, and service. You agree to:
- Follow all operational procedures in the driver handbook, including reporting, punctuality, presentation, and fueling protocols.
- Be punctual. Muvment treats lateness seriously, and you should aim to arrive ahead of the scheduled pickup time.
- Drive safely and lawfully at all times, obey speed limits, and never use a handheld device while the vehicle is in motion.
- Treat clients with courtesy and respect their privacy and confidentiality.
- Keep the vehicle clean, roadworthy, and ready for service.
- Communicate with the operations team through approved channels when required, for example when extra time on a trip begins.

7. Prohibited activities
The following are strictly prohibited and may lead to formal queries, financial penalties, or termination under the three-strike policy and driver handbook:
- Falsifying, skipping, or manipulating inspections, photos, odometer readings, or fuel levels.
- Running offline or undocumented trips.
- Soliciting or begging clients for money, tips, or personal favors.
- Driving under the influence of alcohol or any substance, or failing an alcohol test.
- Distracted driving, unsafe driving, or traffic offenses.
- Rudeness or misconduct toward clients or staff.
- Sharing your account, tampering with the app, or attempting to bypass its controls or security.
- Using client information or anything seen or heard in the vehicle for any purpose other than performing the trip.

8. Payment requests and allowances
- The app lets you submit requests for eligible payments, such as extra hours. It does not itself process or guarantee payment.
- Requests move through review (pending, in review, approved or rejected) before any payment is made, and are paid according to Muvment policy.
- Allowances and reimbursements are governed by the driver handbook. Submit requests accurately and with any required evidence, such as receipts for tolls or airport fees.
- Submitting false, inflated, or duplicate payment requests is a breach of these terms and may result in disciplinary action.

9. Vehicle care and accountability
You are responsible for the assigned vehicle while it is in your care. The inspection records you capture in the app document the condition of the vehicle at each handover and are used to resolve disputes. You must report any damage, fault, or incident promptly. Responsibility for damage, penalties, and related costs is handled in line with the driver handbook.

10. Confidentiality
Muvment serves clients who value privacy. Anything you see, hear, or learn about a client, their identity, destination, or business is strictly confidential. You must not repeat, record, or share it, and you must not share operational or client information from the app with anyone outside Muvment. This obligation continues after your engagement ends.

11. Device and permissions
- The app needs camera access to capture vehicle photos and your selfie, and location access to tag inspection photos and provide navigation. Without these permissions, you may not be able to complete trips.
- You are responsible for maintaining a compatible device and an active data connection. Any data allowance provided by Muvment is governed by the driver handbook.
- Keep the app updated to the latest version so it works correctly and securely.

12. Ownership of the app
The Muvment driver app, including its design, content, and software, is owned by Muvment and its licensors and is protected by law. You are granted a limited, non-exclusive, non-transferable right to use the app solely to perform your duties as a Muvment driver. You may not copy, modify, reverse-engineer, resell, or otherwise use the app outside this permitted purpose.

13. Disclaimers
The app is provided on an "as is" and "as available" basis. While we work to keep it reliable, we do not guarantee that it will always be available, uninterrupted, or error-free, or that navigation and estimated times provided through third-party services will always be accurate. You remain responsible for driving safely and lawfully and for using your own judgment on the road, regardless of what the app shows.

14. Limitation of liability
To the extent permitted by law, Muvment is not liable for indirect, incidental, or consequential losses arising from your use of, or inability to use, the app, including issues caused by device faults, connectivity problems, or third-party services. Nothing in these terms limits any liability that cannot be limited under applicable law, and nothing here affects your rights under your engagement agreement with Muvment.

15. Suspension and termination
We may suspend or disable your access to the app if you breach these terms or the driver handbook, if your engagement with Muvment ends, or where needed to protect drivers, clients, vehicles, or the service. Disciplinary matters, including the three-strike policy and any financial penalties, are handled in line with the driver handbook. You may stop using the app at any time and can request account deletion as described in the privacy policy.

16. Governing law
These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute relating to the app or these terms will be handled in line with your engagement agreement with Muvment and, where relevant, resolved by the courts of Nigeria.

17. Changes to these terms
We may update these terms from time to time as the app, our policies, or the law change. When we make material changes, we will update the "last updated" date and, where appropriate, notify you in the app. Continuing to use the app after an update means you accept the revised terms.

18. Contact us
If you have questions about these terms, contact us at support@muvment.ng, or reach out to the Muvment operations team through the channels provided to you.`,
  title: "Employee Terms of Use",
  shortTitle: "Terms of Use",
  intro: "The rules for using the Muvment driver app. They sit alongside your engagement agreement and the driver handbook.",
  icon: "invoice",
  tint: "#007AFF",
  details: [
    { label: "Last updated", value: "August 2026" },
    { label: "Issued by", value: "Autogirl Limited" },
    { label: "Applies to", value: "Muvment drivers" },
    { label: "Governing law", value: "Nigeria" },
  ],
  summary: [
    {
      icon: "checklist",
      tint: "#34C759",
      title: "Your checklists are the official record",
      body: "Complete every inspection honestly. The photos, odometer and fuel readings you submit document each handover.",
    },
    {
      icon: "lockFill",
      tint: "#5856D6",
      title: "Clients' privacy comes first",
      body: "Anything you see or hear about a client is strictly confidential, during and after your engagement.",
    },
    {
      icon: "banknote",
      tint: "#FF9500",
      title: "Requests are reviewed before payment",
      body: "Payment requests go through review and are paid in line with Muvment policy. False or inflated requests are a breach.",
    },
    {
      icon: "warning",
      tint: "#FF3B30",
      title: "Breaches have consequences",
      body: "Prohibited conduct can lead to queries, penalties or termination under the three-strike policy.",
    },
  ],
  agreement:
    "By logging in and using the Muvment driver app, you agree to these terms and to the driver handbook.",
};
