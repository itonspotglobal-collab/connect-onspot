import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

// The ACL policy of the object.
// Stored as JSON in object custom metadata under key "custom:aclPolicy".
//
// NOTE: aclRules-based access group scaffolding (ObjectAccessGroupType,
// ObjectAclRule, ObjectAccessGroup, BaseObjectAccessGroup,
// createObjectAccessGroup) was removed — it was never implemented and
// the ObjectAccessGroupType enum had no members. Admin access to
// hiring-pipeline documents is handled via the scoped bypass in the
// /api/objects serving route (see admin_file_access_log audit table).
export interface ObjectAclPolicy {
  owner?: string;
  visibility: "public" | "private";
}

// Sets the ACL policy to the object metadata.
export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

// Gets the ACL policy from the object metadata.
export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy as string);
}

// Checks if the user can access the object.
// Access is granted when:
//   • visibility === "public"  AND requestedPermission === READ
//   • userId matches aclPolicy.owner  (any permission)
// Admin access to hiring-pipeline documents uses a separate scoped bypass
// in the serving route rather than this function.
export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  // Public objects are always accessible for read.
  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  // Access control requires the user id.
  if (!userId) {
    return false;
  }

  // The owner of the object can always access it.
  if (aclPolicy.owner === userId) {
    return true;
  }

  return false;
}
