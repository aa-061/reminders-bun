import { type Context } from "elysia";
import type { TDeleteRemindersBulkOutput } from "../schemas";
import { getReminderRepository } from "../repositories";

export const deleteRemindersBulkRoute = ({
  request,
  set,
}: Context): TDeleteRemindersBulkOutput => {
  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");
    if (!idsParam) {
      throw new Error(
        "Delete reminders in bulk endpoint required 'ids' search param which is equal to comma separated list of reminder IDs to delete, e.g. '/bulk?ids=12,13,14'. No 'ids' search param has been passed.",
      );
    }

    let ids: number[] = [];

    if (/^\d+-\d+$/.test(idsParam)) {
      const [start, end] = idsParam.split("-").map(Number);

      for (let i = start; i <= end; i++) {
        ids.push(i);
      }
    } else {
      ids = idsParam
        .split(",")
        .map((idStr) => Number(idStr.trim()))
        .filter((n) => !Number.isNaN(n));
    }

    const repo = getReminderRepository();
    const deletedCount = repo.deleteBulk(ids);

    return {
      status: "success",
      deletedCount,
    };
  } catch (error) {
    set.status = 500;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "fail",
      error: `Failed to delete reminders in bulk. Error: ${errorMessage}`,
    };
  }
};
