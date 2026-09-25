/// <reference types="jest" />

import { ForbiddenException } from "@nestjs/common";
import { AdminRoleGuard } from "./admin-role.guard";

function contextWithRoles(roles: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { "x-user-roles": roles } }),
    }),
  } as never;
}

describe("AdminRoleGuard", () => {
  it("allows only ADMIN", () => {
    expect(new AdminRoleGuard().canActivate(contextWithRoles("ADMIN"))).toBe(
      true,
    );
  });

  it("rejects SUPPORT_AGENT even when the user has Admin Center access", () => {
    expect(() =>
      new AdminRoleGuard().canActivate(contextWithRoles("SUPPORT_AGENT")),
    ).toThrow(ForbiddenException);
  });

  it("rejects a missing role header", () => {
    expect(() =>
      new AdminRoleGuard().canActivate(contextWithRoles("")),
    ).toThrow(ForbiddenException);
  });
});
