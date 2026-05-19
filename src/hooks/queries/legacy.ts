/**
 * Compatibility barrel — re-exports every symbol the legacy
 * `@/hooks/useAppUsers` shim exposed. Lets consumers migrate by
 * changing the import path only.
 */
export {
  useAppUsersQuery as useAppUsers,
  nameKey,
  type AppUser,
} from "./useAppUsersQuery";
export { useVsdUsersQuery as useVsdUsers, VSD_NAMES } from "./useVsdUsersQuery";
export { useBopmDirectoryQuery as useBopmDirectory } from "./useBopmDirectoryQuery";
export {
  useVsdHierarchy,
  useAllPersonNames,
  dealCellMatchesPerson,
} from "./useVsdHierarchyQuery";
