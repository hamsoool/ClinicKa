export type LegalSection = {
  title: string;
  body: string;
  bullets?: string[];
};

export const POLICY_UPDATED_AT = 'April 29, 2026';
export const CONTACT_EMAIL = 'digitalduo.clinicka@gmail.com';

export const termsSections: LegalSection[] = [
  {
    title: 'Who may use the portal',
    body:
      'The Clinic Management System is intended for Gordon College students, clinic staff, and authorized administrators handling school health records and related transactions.',
    bullets: [
      'Access is limited to users with a valid Gordon College account.',
      'Clinic workflows and records may only be handled by authorized personnel.',
    ],
  },
  {
    title: 'Account responsibility',
    body:
      'You are responsible for protecting your password and for all actions performed under your account.',
    bullets: [
      'Do not share credentials or allow another person to use your account.',
      'Report suspected account compromise or unauthorized access immediately.',
    ],
  },
  {
    title: 'Accurate submissions',
    body:
      'All information and uploaded files submitted through the portal must be truthful, complete, and reasonably current.',
    bullets: [
      'Use your real student details and current contact information.',
      'Do not upload altered, misleading, or unrelated medical documents.',
    ],
  },
  {
    title: 'Acceptable use',
    body:
      'The portal must not be used in a way that harms the system, other users, or Gordon College operations.',
    bullets: [
      "Malicious files, impersonation, and misuse of another person's records are prohibited.",
      'Users must follow applicable school policies, privacy rules, and law.',
    ],
  },
  {
    title: 'Clinic review',
    body:
      'Submitted records may be reviewed, returned for correction, or processed by authorized clinic personnel as part of health compliance and school record management.',
  },
  {
    title: 'Service changes',
    body:
      'Gordon College may update the portal, its workflows, and related rules when needed for operations, security, or compliance.',
  },
];

export const privacySections: LegalSection[] = [
  {
    title: 'Overview',
    body:
      'This notice explains how personal data is handled in the Gordon College Clinic Management System. It reflects the Gordon College General Privacy Notice and applies to account registration, record submission, and clinic-related workflows in the portal.',
  },
  {
    title: 'Information we collect',
    body:
      'The portal may collect personal, academic, contact, and medical information needed to manage clinic transactions and student health requirements.',
    bullets: [
      'Identity details such as name, birth date, sex, civil status, and affiliations.',
      'Contact details such as address, email address, and mobile number.',
      'Academic details such as course, department, year level, and school-related standing.',
      'Medical details such as history, physical measurements, laboratory files, and clinic submissions.',
    ],
  },
  {
    title: 'Why we process your data',
    body:
      'Gordon College processes personal data to support its obligations as a higher education institution and to administer clinic-related services and compliance requirements.',
    bullets: [
      'To manage medical record submissions and clinic review workflows.',
      'To support school health requirements, documentation, and follow-up.',
      'To comply with academic, administrative, legal, and regulatory obligations.',
    ],
  },
  {
    title: 'How data is collected',
    body:
      'Personal data may be collected through online forms, uploaded files, email-based registration, and related supporting documents submitted through the portal or school processes.',
  },
  {
    title: 'Storage, transfer, and retention',
    body:
      'Records may be stored in physical or electronic systems managed or controlled by Gordon College. Data may be retained and transferred in accordance with school policy and applicable privacy rules.',
    bullets: [
      'Electronic records may be stored in secure cloud-based or institution-managed systems.',
      'Retention periods follow applicable Gordon College records management practices.',
    ],
  },
  {
    title: 'Your rights as a data subject',
    body:
      'Subject to school policy and applicable law, data subjects may exercise rights over their personal data.',
    bullets: [
      'Right to be informed.',
      'Right to access and request correction of personal data.',
      'Right to object where applicable.',
      'Right to erasure or blocking where legally permitted.',
    ],
  },
  {
    title: 'Data Privacy Office',
    body:
      'For privacy-related concerns, requests, or questions, you may contact Gordon College through its Data Privacy Office.',
    bullets: [
      `Email: ${CONTACT_EMAIL}`,
      'Phone: (047) 222-4080',
      'Address: Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City 2200',
    ],
  },
];
