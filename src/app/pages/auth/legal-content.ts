export type LegalSection = {
  title: string;
  body: string;
  bullets?: string[];
};

export const POLICY_UPDATED_AT = 'September 21, 2026';
export const CONTACT_EMAIL = 'dpo@gordoncollege.edu.ph';

export const termsSections: LegalSection[] = [
  {
    title: 'Purpose and authorized users',
    body:
      'ClinicKa is Gordon College’s clinic management and student health-record portal. It supports annual medical-clearance submissions, clinic review, document handling, account administration, and related health-services workflows.',
    bullets: [
      'Students may use the portal for their own profile, medical-clearance, and related clinic transactions.',
      'Clinic staff and authorized medical personnel may review and process records within their assigned responsibilities.',
      'Administrators may manage approved operational and account workflows. Administrative access does not automatically grant unrestricted clinical access.',
      'Super Administrators may manage administrator accounts and system oversight functions according to their assigned permissions.',
    ],
  },
  {
    title: 'Account and credential responsibility',
    body:
      'You are responsible for maintaining the confidentiality of your account credentials and for activity performed through your authenticated session.',
    bullets: [
      'Do not share passwords, authentication tokens, one-time codes, or account access with another person.',
      'Use only the account issued or registered for you and provide accurate account information.',
      'Use the Password Support instructions in the sign-in screen for password-reset requests; ClinicKa does not provide self-service password resets.',
      'Report suspected compromise, impersonation, or unauthorized access to the Gordon College web administrator or Data Privacy Office.',
    ],
  },
  {
    title: 'Medical submissions and documents',
    body:
      'Information submitted through ClinicKa is used for Gordon College clinic workflows and must be truthful, complete, relevant, and reasonably current.',
    bullets: [
      'Submit only your own information or information you are authorized to submit on behalf of the relevant person.',
      'Upload clear, valid, and relevant laboratory, examination, and supporting documents requested by the clinic.',
      'Do not upload altered, misleading, malicious, unlawful, or unrelated files.',
      'Keep physical originals when the clinic requires them for verification or examination.',
    ],
  },
  {
    title: 'Authorized access and acceptable use',
    body:
      'ClinicKa must be used only for legitimate Gordon College clinic, health-record, account, and administrative purposes. Access to another person’s information must be authorized by role, workflow, and applicable policy.',
    bullets: [
      'Do not search for, view, download, alter, disclose, or attempt to retrieve records outside your authorization.',
      'Do not bypass authentication, role checks, encrypted storage, signed document access, rate limits, or other security controls.',
      'Do not probe endpoints, enumerate students or files, forge audit events, impersonate users, or submit arbitrary client-defined security data.',
      'Do not interfere with availability, integrity, confidentiality, or normal operation of the portal.',
    ],
  },
  {
    title: 'Clinic review and decisions',
    body:
      'Submitted records may be reviewed, verified, returned for correction, updated, approved, rejected, or otherwise processed by authorized clinic personnel as part of Gordon College health compliance and record management.',
    bullets: [
      'ClinicKa supports administrative record handling and does not replace professional medical judgment, emergency care, or a direct consultation with qualified healthcare personnel.',
      'A submission or uploaded document is not considered accepted until the applicable clinic workflow confirms its status.',
      'Users must follow instructions from authorized clinic personnel regarding physical documents, examinations, corrections, and follow-up.',
    ],
  },
  {
    title: 'Security and accountability',
    body:
      'ClinicKa uses authentication, role-based authorization, protected document delivery, encryption, integrity checks, and audit logging to support secure clinic operations.',
    bullets: [
      'Access to sensitive records and security-relevant changes may be logged for accountability, investigation, and compliance purposes.',
      'Audit records are designed to be append-only and may be visible only to authorized administrative roles according to the application’s access rules.',
      'Users must cooperate with security reviews and must not attempt to conceal, alter, or remove evidence of portal activity.',
    ],
  },
  {
    title: 'Service availability and changes',
    body:
      'Gordon College may update, suspend, restrict, or change ClinicKa and its workflows when necessary for maintenance, security, privacy, legal compliance, data protection, or operational requirements.',
    bullets: [
      'The portal may be temporarily unavailable during maintenance or infrastructure work.',
      'Users should not rely on ClinicKa as the only copy of information they are required to retain or present to the clinic.',
      'Gordon College may restrict or suspend an account when required to protect users, records, or system operations, subject to applicable policy and procedures.',
    ],
  },
  {
    title: 'Privacy and governing requirements',
    body:
      'Use of ClinicKa is subject to the Gordon College General Privacy Notice, Gordon College data-protection and records-management policies, the Data Privacy Act of 2012 and its Implementing Rules and Regulations, applicable National Privacy Commission issuances, and other applicable laws and institutional rules.',
    bullets: [
      'The Privacy Policy presented in this portal explains how these requirements apply to ClinicKa’s data processing activities.',
      'Where a conflict exists, applicable law and official Gordon College policy take precedence over a general portal description.',
    ],
  },
];

export const privacySections: LegalSection[] = [
  {
    title: 'Purpose of this notice',
    body:
      'This notice explains how Gordon College processes personal data through ClinicKa, the Gordon College clinic management and student health-record system. It is a privacy notice, not a consent form, and should be read together with the Gordon College General Privacy Notice and applicable data-protection policies.',
  },
  {
    title: 'Processing activities',
    body:
      'Gordon College processes personal data to perform its obligations and functions as a government instrumentality and higher education institution, administer clinic services, and meet applicable legal, regulatory, academic, administrative, audit, and reporting requirements.',
    bullets: [
      'ClinicKa uses account and session information to authenticate users and enforce role-based access.',
      'ClinicKa uses submitted information to process annual medical clearance and related clinic workflows.',
      'ClinicKa records relevant access and changes in an append-only audit trail for accountability and security review.',
    ],
  },
  {
    title: 'Personal data collected',
    body:
      'Depending on the workflow, ClinicKa may collect personal, contact, academic, account, and health-related information supplied by a student or authorized Gordon College personnel.',
    bullets: [
      'Name, birth date, sex, civil status, student number, course, department, year level, and affiliations.',
      'Address, email address, telephone or mobile number, and emergency-contact information.',
      'Medical history, allergies, physical examination information, measurements, laboratory information, clearance details, and uploaded medical documents.',
      'Account, role, authentication, device, IP-address, browser, and activity information needed for security and audit purposes.',
    ],
  },
  {
    title: 'Collection methods',
    body:
      'Gordon College may collect data physically through forms and supporting documents, and electronically through ClinicKa forms, secure file uploads, account processes, email, and information entered by authorized users during clinic review.',
  },
  {
    title: 'Use and disclosure',
    body:
      'Personal data is used proportionately for legitimate Gordon College purposes and is disclosed only to authorized personnel, service providers, or government and institutional recipients when necessary for the stated purposes, legal obligations, or applicable records and privacy requirements.',
    bullets: [
      'Clinic staff and authorized medical personnel access records only within their assigned workflow and role permissions.',
      'Administrators may manage system operations and accountability without automatically receiving unrestricted clinical access.',
      'Audit records identify access and changes without intentionally storing medical results or document contents.',
    ],
  },
  {
    title: 'Security safeguards',
    body:
      'Gordon College applies administrative, technical, and organizational safeguards appropriate to the information processed through ClinicKa.',
    bullets: [
      'Authentication and server-side role-based authorization protect portal and record access.',
      'Sensitive medical documents are encrypted at rest using AES-256-GCM and checked with SHA-256 integrity verification.',
      'Documents are served through authorized, short-lived HMAC-signed streaming tickets rather than permanent public medical-file URLs.',
      'Access and security events are recorded through an append-only audit log. Audit metadata is allowlisted and excludes passwords, tokens, keys, medical values, and document contents.',
      'Uploaded images undergo available metadata and EXIF sanitization controls before storage.',
    ],
  },
  {
    title: 'Storage, transfer, and retention',
    body:
      'Personal data may be stored in physical records and electronic systems managed or controlled by Gordon College, including institution-managed servers or approved cloud services. Transfers are handled in accordance with the Data Privacy Act of 2012, its Implementing Rules and Regulations, National Privacy Commission issuances, and Gordon College policies.',
    bullets: [
      'Retention follows the Gordon College Records Management Policy and applicable records-retention requirements.',
      'Where no specific retention rule applies, the responsible office retains data according to applicable government and institutional practice.',
      'Audit records are retained for accountability and security purposes according to the configured operational retention policy.',
    ],
  },
  {
    title: 'Rights and responsibilities',
    body:
      'Subject to Gordon College policy and applicable law, stakeholders may exercise their rights as data subjects and are expected to help protect personal data.',
    bullets: [
      'Rights include being informed, access, rectification, objection where applicable, and erasure or blocking where legally permitted.',
      'Provide true and accurate information and obtain appropriate authority before submitting another person’s data.',
      'Respect the privacy of other students and do not disclose or misuse non-public clinic information.',
      'Report suspected unauthorized access, security incidents, or personal-data breaches to the Gordon College Data Privacy Office.',
    ],
  },
  {
    title: 'Data Privacy Office',
    body:
      'Privacy inquiries, requests, and concerns may be directed to the Gordon College Data Privacy Office.',
    bullets: [
      `Email: ${CONTACT_EMAIL}`,
      'Phone: (047) 222-4080',
      'Address: Olongapo City Sports Complex, Donor Street, East Tapinac, Olongapo City 2200',
    ],
  },
];
