export const LAB_UPLOAD_TYPES = ['cbc', 'urinalysis', 'xray'] as const;
export type LabUploadType = (typeof LAB_UPLOAD_TYPES)[number];

export const STUDENT_PROFILE_ASSET_UPLOAD_TYPES = ['photo', 'signature'] as const;
export type StudentProfileAssetUploadType = (typeof STUDENT_PROFILE_ASSET_UPLOAD_TYPES)[number];
