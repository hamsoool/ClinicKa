-- Demo seed for 50 student accounts and sample records.
-- Login format:
--   email    = <student_id>@gordoncollege.edu.ph
--   password = Demo12345!
--
-- Recommended: run this in the Supabase SQL editor using a service-role session.
-- The script is idempotent for the seeded student IDs below.

begin;

with seed_rows (
  seq,
  student_id,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  year_level,
  sex,
  age,
  birthday,
  submission_category,
  submission_status
) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (student_id || '@gordoncollege.edu.ph') as email,
    (
      substr(md5(student_id || '@gordoncollege.edu.ph'), 1, 8) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 9, 4) || '-4' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 14, 3) || '-a' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 18, 3) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 21, 12)
    )::uuid as user_id,
    (
      substr(md5('submission:' || student_id), 1, 8) || '-' ||
      substr(md5('submission:' || student_id), 9, 4) || '-4' ||
      substr(md5('submission:' || student_id), 14, 3) || '-a' ||
      substr(md5('submission:' || student_id), 18, 3) || '-' ||
      substr(md5('submission:' || student_id), 21, 12)
    )::uuid as submission_id,
    (
      substr(md5('identity:' || student_id), 1, 8) || '-' ||
      substr(md5('identity:' || student_id), 9, 4) || '-4' ||
      substr(md5('identity:' || student_id), 14, 3) || '-a' ||
      substr(md5('identity:' || student_id), 18, 3) || '-' ||
      substr(md5('identity:' || student_id), 21, 12)
    )::uuid as identity_id,
    ('(+63) 9' || lpad(seq::text, 9, '0')) as contact_number,
    ('Block ' || seq || ', Gordon Heights, Olongapo City') as address,
    (now() - ((60 - seq) || ' days')::interval) as submitted_at,
    (now() - ((58 - seq) || ' days')::interval) as updated_at,
    case
      when submission_status = 'returned' then 'Please update the contact details and attached lab information.'
      when submission_status = 'resubmitted' then 'Student resubmitted the record after requested corrections.'
      when submission_status = 'approved' then 'Demo-approved record for presentation.'
      else null
    end as staff_notes,
    case
      when seq % 7 = 0 then 'Seafood allergy'
      when seq % 11 = 0 then 'Dust allergy'
      else null
    end as allergy_details,
    case when seq % 9 = 0 then true else false end as had_operation,
    case when seq % 9 = 0 then 'Appendectomy in previous school year' else null end as operation_details,
    (48 + (seq % 18))::numeric as weight_value,
    (150 + (seq % 25))::numeric as height_value,
    round(((48 + (seq % 18))::numeric / power(((150 + (seq % 25))::numeric / 100), 2)), 2) as bmi_value
  from seed_rows
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  last_sign_in_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  user_id,
  'authenticated',
  'authenticated',
  email,
  crypt('Demo12345!', gen_salt('bf')),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'first_name', first_name,
    'last_name', last_name,
    'student_id', student_id
  ),
  now(),
  now(),
  now()
from seed_enriched
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmed_at = excluded.confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at,
  last_sign_in_at = excluded.last_sign_in_at;

with seed_rows (
  seq,
  student_id,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  year_level,
  sex,
  age,
  birthday,
  submission_category,
  submission_status
) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (student_id || '@gordoncollege.edu.ph') as email,
    (
      substr(md5(student_id || '@gordoncollege.edu.ph'), 1, 8) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 9, 4) || '-4' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 14, 3) || '-a' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 18, 3) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 21, 12)
    )::uuid as user_id,
    (
      substr(md5('submission:' || student_id), 1, 8) || '-' ||
      substr(md5('submission:' || student_id), 9, 4) || '-4' ||
      substr(md5('submission:' || student_id), 14, 3) || '-a' ||
      substr(md5('submission:' || student_id), 18, 3) || '-' ||
      substr(md5('submission:' || student_id), 21, 12)
    )::uuid as submission_id,
    (
      substr(md5('identity:' || student_id), 1, 8) || '-' ||
      substr(md5('identity:' || student_id), 9, 4) || '-4' ||
      substr(md5('identity:' || student_id), 14, 3) || '-a' ||
      substr(md5('identity:' || student_id), 18, 3) || '-' ||
      substr(md5('identity:' || student_id), 21, 12)
    )::uuid as identity_id,
    ('(+63) 9' || lpad(seq::text, 9, '0')) as contact_number,
    ('Block ' || seq || ', Gordon Heights, Olongapo City') as address,
    (now() - ((60 - seq) || ' days')::interval) as submitted_at,
    (now() - ((58 - seq) || ' days')::interval) as updated_at,
    case
      when submission_status = 'returned' then 'Please update the contact details and attached lab information.'
      when submission_status = 'resubmitted' then 'Student resubmitted the record after requested corrections.'
      when submission_status = 'approved' then 'Demo-approved record for presentation.'
      else null
    end as staff_notes,
    case
      when seq % 7 = 0 then 'Seafood allergy'
      when seq % 11 = 0 then 'Dust allergy'
      else null
    end as allergy_details,
    case when seq % 9 = 0 then true else false end as had_operation,
    case when seq % 9 = 0 then 'Appendectomy in previous school year' else null end as operation_details,
    (48 + (seq % 18))::numeric as weight_value,
    (150 + (seq % 25))::numeric as height_value,
    round(((48 + (seq % 18))::numeric / power(((150 + (seq % 25))::numeric / 100), 2)), 2) as bmi_value
  from seed_rows
)
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  identity_id,
  user_id,
  jsonb_build_object(
    'sub', user_id::text,
    'email', email,
    'email_verified', true
  ),
  'email',
  email,
  now(),
  now(),
  now()
from seed_enriched
on conflict (id) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  provider = excluded.provider,
  provider_id = excluded.provider_id,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = excluded.updated_at;

with seed_rows (
  seq,
  student_id,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  year_level,
  sex,
  age,
  birthday,
  submission_category,
  submission_status
) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (student_id || '@gordoncollege.edu.ph') as email,
    (
      substr(md5(student_id || '@gordoncollege.edu.ph'), 1, 8) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 9, 4) || '-4' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 14, 3) || '-a' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 18, 3) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 21, 12)
    )::uuid as user_id,
    (
      substr(md5('submission:' || student_id), 1, 8) || '-' ||
      substr(md5('submission:' || student_id), 9, 4) || '-4' ||
      substr(md5('submission:' || student_id), 14, 3) || '-a' ||
      substr(md5('submission:' || student_id), 18, 3) || '-' ||
      substr(md5('submission:' || student_id), 21, 12)
    )::uuid as submission_id,
    ('(+63) 9' || lpad(seq::text, 9, '0')) as contact_number,
    ('Block ' || seq || ', Gordon Heights, Olongapo City') as address
  from seed_rows
)
insert into public.profiles (
  id,
  role,
  email,
  first_name,
  last_name,
  student_id,
  department,
  course,
  created_at,
  updated_at
)
select
  user_id,
  'student',
  email,
  first_name,
  last_name,
  student_id,
  department,
  course,
  now(),
  now()
from seed_enriched
on conflict (id) do update
set
  role = excluded.role,
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  student_id = excluded.student_id,
  department = excluded.department,
  course = excluded.course,
  updated_at = excluded.updated_at;

with seed_rows (
  seq,
  student_id,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  year_level,
  sex,
  age,
  birthday,
  submission_category,
  submission_status
) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (student_id || '@gordoncollege.edu.ph') as email,
    (
      substr(md5(student_id || '@gordoncollege.edu.ph'), 1, 8) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 9, 4) || '-4' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 14, 3) || '-a' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 18, 3) || '-' ||
      substr(md5(student_id || '@gordoncollege.edu.ph'), 21, 12)
    )::uuid as user_id,
    ('(+63) 9' || lpad(seq::text, 9, '0')) as contact_number,
    ('Block ' || seq || ', Gordon Heights, Olongapo City') as address
  from seed_rows
)
insert into public.students (
  student_id,
  profile_id,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  age,
  sex,
  birthday,
  civil_status,
  contact_number,
  address,
  year_level,
  submission_category,
  submission_target_year_level
)
select
  student_id,
  user_id,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  age,
  sex,
  birthday,
  'Single',
  contact_number,
  address,
  year_level,
  submission_category,
  year_level
from seed_enriched
on conflict (student_id) do update
set
  profile_id = excluded.profile_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  middle_initial = excluded.middle_initial,
  department = excluded.department,
  course = excluded.course,
  age = excluded.age,
  sex = excluded.sex,
  birthday = excluded.birthday,
  civil_status = excluded.civil_status,
  contact_number = excluded.contact_number,
  address = excluded.address,
  year_level = excluded.year_level,
  submission_category = excluded.submission_category,
  submission_target_year_level = excluded.submission_target_year_level;

with seed_rows (
  seq,
  student_id,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  year_level,
  sex,
  age,
  birthday,
  submission_category,
  submission_status
) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (
      substr(md5('submission:' || student_id), 1, 8) || '-' ||
      substr(md5('submission:' || student_id), 9, 4) || '-4' ||
      substr(md5('submission:' || student_id), 14, 3) || '-a' ||
      substr(md5('submission:' || student_id), 18, 3) || '-' ||
      substr(md5('submission:' || student_id), 21, 12)
    )::uuid as submission_id,
    ('(+63) 9' || lpad(seq::text, 9, '0')) as contact_number,
    ('Block ' || seq || ', Gordon Heights, Olongapo City') as address,
    (now() - ((60 - seq) || ' days')::interval) as submitted_at,
    (now() - ((58 - seq) || ' days')::interval) as updated_at,
    case
      when submission_status = 'returned' then 'Please update the contact details and attached lab information.'
      when submission_status = 'resubmitted' then 'Student resubmitted the record after requested corrections.'
      when submission_status = 'approved' then 'Demo-approved record for presentation.'
      else null
    end as staff_notes,
    case
      when seq % 7 = 0 then 'Seafood allergy'
      when seq % 11 = 0 then 'Dust allergy'
      else null
    end as allergy_details,
    case when seq % 9 = 0 then true else false end as had_operation,
    case when seq % 9 = 0 then 'Appendectomy in previous school year' else null end as operation_details,
    (48 + (seq % 18))::numeric as weight_value,
    (150 + (seq % 25))::numeric as height_value,
    round(((48 + (seq % 18))::numeric / power(((150 + (seq % 25))::numeric / 100), 2)), 2) as bmi_value
  from seed_rows
)
insert into public.submissions (
  id,
  student_id,
  year_level,
  status,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  age,
  sex,
  birthday,
  civil_status,
  contact_number,
  address,
  allergy_details,
  had_operation,
  operation_details,
  weight,
  height,
  bmi,
  data_privacy_consent,
  submission_category,
  submission_target_year_level,
  staff_notes,
  submitted_at,
  updated_at
)
select
  submission_id,
  student_id,
  year_level,
  submission_status,
  first_name,
  last_name,
  middle_initial,
  department,
  course,
  age,
  sex,
  birthday,
  'Single',
  contact_number,
  address,
  allergy_details,
  had_operation,
  operation_details,
  weight_value,
  height_value,
  bmi_value,
  true,
  submission_category,
  year_level,
  staff_notes,
  submitted_at,
  updated_at
from seed_enriched
on conflict (id) do update
set
  student_id = excluded.student_id,
  year_level = excluded.year_level,
  status = excluded.status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  middle_initial = excluded.middle_initial,
  department = excluded.department,
  course = excluded.course,
  age = excluded.age,
  sex = excluded.sex,
  birthday = excluded.birthday,
  civil_status = excluded.civil_status,
  contact_number = excluded.contact_number,
  address = excluded.address,
  allergy_details = excluded.allergy_details,
  had_operation = excluded.had_operation,
  operation_details = excluded.operation_details,
  weight = excluded.weight,
  height = excluded.height,
  bmi = excluded.bmi,
  data_privacy_consent = excluded.data_privacy_consent,
  submission_category = excluded.submission_category,
  submission_target_year_level = excluded.submission_target_year_level,
  staff_notes = excluded.staff_notes,
  submitted_at = excluded.submitted_at,
  updated_at = excluded.updated_at;

with seed_rows (seq, student_id, first_name, last_name, middle_initial, department, course, year_level, sex, age, birthday, submission_category, submission_status) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (
      substr(md5('submission:' || student_id), 1, 8) || '-' ||
      substr(md5('submission:' || student_id), 9, 4) || '-4' ||
      substr(md5('submission:' || student_id), 14, 3) || '-a' ||
      substr(md5('submission:' || student_id), 18, 3) || '-' ||
      substr(md5('submission:' || student_id), 21, 12)
    )::uuid as submission_id,
    ('(+63) 9' || lpad(seq::text, 9, '0')) as contact_number,
    ('Block ' || seq || ', Gordon Heights, Olongapo City') as address
  from seed_rows
)
insert into public.emergency_contacts (
  submission_id,
  name,
  relationship,
  phone,
  address
)
select
  submission_id,
  'Parent of ' || first_name || ' ' || last_name,
  'Parent',
  contact_number,
  address
from seed_enriched
on conflict (submission_id) do update
set
  name = excluded.name,
  relationship = excluded.relationship,
  phone = excluded.phone,
  address = excluded.address;

with seed_rows (seq, student_id, first_name, last_name, middle_initial, department, course, year_level, sex, age, birthday, submission_category, submission_status) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (
      substr(md5('submission:' || student_id), 1, 8) || '-' ||
      substr(md5('submission:' || student_id), 9, 4) || '-4' ||
      substr(md5('submission:' || student_id), 14, 3) || '-a' ||
      substr(md5('submission:' || student_id), 18, 3) || '-' ||
      substr(md5('submission:' || student_id), 21, 12)
    )::uuid as submission_id
  from seed_rows
)
insert into public.medical_history (
  submission_id,
  allergy,
  asthma,
  chicken_pox,
  diabetes,
  dysmenorrhea,
  epilepsy_seizure,
  heart_disorder,
  hepatitis,
  hypertension,
  measles,
  mumps,
  anxiety_disorder,
  panic_attack,
  pneumonia,
  ptb_primary_complex,
  typhoid_fever,
  covid19,
  uti,
  others
)
select
  submission_id,
  (seq % 7 = 0),
  (seq % 6 = 0),
  (seq % 5 = 0),
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  (seq % 12 = 0),
  false,
  false,
  false,
  false,
  false,
  false,
  case when seq % 10 = 0 then 'Seasonal allergies' else null end
from seed_enriched
on conflict (submission_id) do update
set
  allergy = excluded.allergy,
  asthma = excluded.asthma,
  chicken_pox = excluded.chicken_pox,
  diabetes = excluded.diabetes,
  dysmenorrhea = excluded.dysmenorrhea,
  epilepsy_seizure = excluded.epilepsy_seizure,
  heart_disorder = excluded.heart_disorder,
  hepatitis = excluded.hepatitis,
  hypertension = excluded.hypertension,
  measles = excluded.measles,
  mumps = excluded.mumps,
  anxiety_disorder = excluded.anxiety_disorder,
  panic_attack = excluded.panic_attack,
  pneumonia = excluded.pneumonia,
  ptb_primary_complex = excluded.ptb_primary_complex,
  typhoid_fever = excluded.typhoid_fever,
  covid19 = excluded.covid19,
  uti = excluded.uti,
  others = excluded.others;

with seed_rows (seq, student_id, first_name, last_name, middle_initial, department, course, year_level, sex, age, birthday, submission_category, submission_status) as (
  values
    (1, '202311001', 'Andrea', 'Santos', 'A', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 1, 'female', 18, DATE '2006-01-01', 'regular', 'pending'),
    (2, '202311002', 'Bianca', 'Reyes', 'B', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 2, 'male', 19, DATE '2005-02-02', 'regular', 'approved'),
    (3, '202311003', 'Carlos', 'Cruz', 'C', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 3, 'female', 20, DATE '2004-03-03', 'regular', 'returned'),
    (4, '202311004', 'Diana', 'Bautista', 'D', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 4, 'male', 21, DATE '2003-04-04', 'returning', 'resubmitted'),
    (5, '202311005', 'Ethan', 'Garcia', 'E', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 1, 'female', 22, DATE '2002-05-05', 'regular', 'approved'),
    (6, '202311006', 'Faith', 'Mendoza', 'F', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 2, 'male', 23, DATE '2001-06-06', 'repeater_irregular', 'pending'),
    (7, '202311007', 'Gabriel', 'Torres', 'G', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 3, 'female', 18, DATE '2006-07-07', 'regular', 'approved'),
    (8, '202311008', 'Hannah', 'Flores', 'H', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 4, 'male', 19, DATE '2005-08-08', 'returning', 'returned'),
    (9, '202311009', 'Ivan', 'Rivera', 'I', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 1, 'female', 20, DATE '2004-09-09', 'regular', 'resubmitted'),
    (10, '202311010', 'Jasmine', 'Ramos', 'J', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 2, 'male', 21, DATE '2003-10-10', 'regular', 'approved'),
    (11, '202311011', 'Kyle', 'Aquino', 'K', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 3, 'female', 22, DATE '2002-11-11', 'regular', 'pending'),
    (12, '202311012', 'Lara', 'Navarro', 'L', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 4, 'male', 23, DATE '2001-12-12', 'regular', 'approved'),
    (13, '202311013', 'Marcus', 'Castro', 'M', 'CEAS', 'Bachelor of Culture and Arts Education', 1, 'female', 18, DATE '2006-01-13', 'regular', 'returned'),
    (14, '202311014', 'Nina', 'Villanueva', 'N', 'CEAS', 'Bachelor of Physical Education (BPEd)', 2, 'male', 19, DATE '2005-02-14', 'returning', 'resubmitted'),
    (15, '202311015', 'Owen', 'Salazar', 'O', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 3, 'female', 20, DATE '2004-03-15', 'regular', 'approved'),
    (16, '202311016', 'Paula', 'Domingo', 'P', 'CEAS', 'Bachelor of Secondary Education major in English', 4, 'male', 21, DATE '2003-04-16', 'repeater_irregular', 'pending'),
    (17, '202311017', 'Quinn', 'Mercado', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 1, 'female', 22, DATE '2002-05-17', 'regular', 'approved'),
    (18, '202311018', 'Rhea', 'Lim', 'R', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 2, 'male', 23, DATE '2001-06-18', 'returning', 'returned'),
    (19, '202311019', 'Sean', 'Fernandez', 'S', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 3, 'female', 18, DATE '2006-07-19', 'regular', 'resubmitted'),
    (20, '202311020', 'Talia', 'Morales', 'T', 'CEAS', 'Bachelor of Secondary Education major in Science', 4, 'male', 19, DATE '2005-08-20', 'regular', 'approved'),
    (21, '202311021', 'Uriel', 'Gutierrez', 'U', 'CEAS', 'Teacher Certificate Program (TCP)', 1, 'female', 20, DATE '2004-09-21', 'regular', 'pending'),
    (22, '202311022', 'Vina', 'Valdez', 'V', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 2, 'male', 21, DATE '2003-10-22', 'regular', 'approved'),
    (23, '202311023', 'Warren', 'Pascual', 'W', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 3, 'female', 22, DATE '2002-11-23', 'regular', 'returned'),
    (24, '202311024', 'Xyra', 'Dizon', 'X', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 4, 'male', 23, DATE '2001-12-24', 'returning', 'resubmitted'),
    (25, '202311025', 'Yana', 'Soriano', 'Y', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 1, 'female', 18, DATE '2006-01-25', 'regular', 'approved'),
    (26, '202311026', 'Zed', 'De Leon', 'Z', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 2, 'male', 19, DATE '2005-02-26', 'repeater_irregular', 'pending'),
    (27, '202311027', 'Aileen', 'Manalo', 'A', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 3, 'female', 20, DATE '2004-03-27', 'regular', 'approved'),
    (28, '202311028', 'Brent', 'Rosales', 'B', 'CBA', 'Bachelor of Science in Business Administration major in Human Resource Management', 4, 'male', 21, DATE '2003-04-01', 'returning', 'returned'),
    (29, '202311029', 'Candice', 'Pineda', 'C', 'CBA', 'Bachelor of Science in Business Administration major in Marketing Management', 1, 'female', 22, DATE '2002-05-02', 'regular', 'resubmitted'),
    (30, '202311030', 'Daryl', 'Alvarez', 'D', 'CBA', 'Bachelor of Science in Customs Administration (BSCA)', 2, 'male', 23, DATE '2001-06-03', 'regular', 'approved'),
    (31, '202311031', 'Elaine', 'Serrano', 'E', 'CCS', 'Bachelor of Science in Computer Science (BSCS)', 3, 'female', 18, DATE '2006-07-04', 'regular', 'pending'),
    (32, '202311032', 'Franco', 'Chavez', 'F', 'CCS', 'Bachelor of Science in Information Technology (BSIT)', 4, 'male', 19, DATE '2005-08-05', 'regular', 'approved'),
    (33, '202311033', 'Giselle', 'Del Rosario', 'G', 'CCS', 'Bachelor of Science in Entertainment and Multimedia Computing (BSEMC)', 1, 'female', 20, DATE '2004-09-06', 'regular', 'returned'),
    (34, '202311034', 'Harvey', 'Magno', 'H', 'CEAS', 'Bachelor of Arts in Communication (BA Comm)', 2, 'male', 21, DATE '2003-10-07', 'returning', 'resubmitted'),
    (35, '202311035', 'Isabel', 'Velasco', 'I', 'CEAS', 'Bachelor of Early Childhood Education (BECEd)', 3, 'female', 22, DATE '2002-11-08', 'regular', 'approved'),
    (36, '202311036', 'Jerome', 'Agustin', 'J', 'CEAS', 'Bachelor of Culture and Arts Education', 4, 'male', 23, DATE '2001-12-09', 'repeater_irregular', 'pending'),
    (37, '202311037', 'Kiara', 'David', 'K', 'CEAS', 'Bachelor of Physical Education (BPEd)', 1, 'female', 18, DATE '2006-01-10', 'regular', 'approved'),
    (38, '202311038', 'Leo', 'Ocampo', 'L', 'CEAS', 'Bachelor of Elementary Education (BEEd)', 2, 'male', 19, DATE '2005-02-11', 'returning', 'returned'),
    (39, '202311039', 'Mika', 'Yap', 'M', 'CEAS', 'Bachelor of Secondary Education major in English', 3, 'female', 20, DATE '2004-03-12', 'regular', 'resubmitted'),
    (40, '202311040', 'Noel', 'Natividad', 'N', 'CEAS', 'Bachelor of Secondary Education major in Filipino', 4, 'male', 21, DATE '2003-04-13', 'regular', 'approved'),
    (41, '202311041', 'Olive', 'Tamayo', 'O', 'CEAS', 'Bachelor of Secondary Education major in Mathematics', 1, 'female', 22, DATE '2002-05-14', 'regular', 'pending'),
    (42, '202311042', 'Pierce', 'Lazaro', 'P', 'CEAS', 'Bachelor of Secondary Education major in Social Studies', 2, 'male', 23, DATE '2001-06-15', 'regular', 'approved'),
    (43, '202311043', 'Queenie', 'Bernardo', 'Q', 'CEAS', 'Bachelor of Secondary Education major in Science', 3, 'female', 18, DATE '2006-07-16', 'regular', 'returned'),
    (44, '202311044', 'Rafael', 'San Jose', 'R', 'CEAS', 'Teacher Certificate Program (TCP)', 4, 'male', 19, DATE '2005-08-17', 'returning', 'resubmitted'),
    (45, '202311045', 'Sofia', 'Vergara', 'S', 'CHTM', 'Bachelor of Science in Hospitality Management (BSHM)', 1, 'female', 20, DATE '2004-09-18', 'regular', 'approved'),
    (46, '202311046', 'Tristan', 'Caballero', 'T', 'CHTM', 'Bachelor of Science in Tourism Management (BSTM)', 2, 'male', 21, DATE '2003-10-19', 'repeater_irregular', 'pending'),
    (47, '202311047', 'Una', 'Padilla', 'U', 'CAHS', 'Bachelor of Science in Nursing (BSN)', 3, 'female', 22, DATE '2002-11-20', 'regular', 'approved'),
    (48, '202311048', 'Vince', 'Mallari', 'V', 'CAHS', 'Bachelor of Science in Midwifery (BSM)', 4, 'male', 23, DATE '2001-12-21', 'returning', 'returned'),
    (49, '202311049', 'Willa', 'Samson', 'W', 'CBA', 'Bachelor of Science in Accountancy (BSA)', 1, 'female', 18, DATE '2006-01-22', 'regular', 'resubmitted'),
    (50, '202311050', 'Xander', 'Tolentino', 'X', 'CBA', 'Bachelor of Science in Business Administration major in Financial Management', 2, 'male', 19, DATE '2005-02-23', 'regular', 'approved')
),
seed_enriched as (
  select
    seed_rows.*,
    (
      substr(md5('submission:' || student_id), 1, 8) || '-' ||
      substr(md5('submission:' || student_id), 9, 4) || '-4' ||
      substr(md5('submission:' || student_id), 14, 3) || '-a' ||
      substr(md5('submission:' || student_id), 18, 3) || '-' ||
      substr(md5('submission:' || student_id), 21, 12)
    )::uuid as submission_id
  from seed_rows
)
insert into public.certificates (
  submission_id,
  findings_normal,
  diagnosis,
  remarks,
  purpose,
  control_no,
  issued_at,
  license_no
)
select
  submission_id,
  true,
  null,
  'Seeded demo clearance for project presentation.',
  case
    when seq % 3 = 0 then 'enrolment,ojt'
    when seq % 2 = 0 then 'enrolment'
    else 'rle'
  end,
  'MC-2026-' || lpad(seq::text, 4, '0'),
  now(),
  '1234567890'
from seed_enriched
where submission_status = 'approved'
on conflict (submission_id) do update
set
  findings_normal = excluded.findings_normal,
  diagnosis = excluded.diagnosis,
  remarks = excluded.remarks,
  purpose = excluded.purpose,
  control_no = excluded.control_no,
  issued_at = excluded.issued_at,
  license_no = excluded.license_no;

commit;
