import { and, gte, lt, lte, sql } from 'drizzle-orm';
import { dayClosings, rentals } from '@rokai/db';
import { addDays, bogotaDate, bogotaInstant } from '@rokai/contracts';
/** Un viaje es un alquiler devuelto, independientemente del número de patinetas. */
export async function completedTrips(exec, now = new Date()) {
    const today = bogotaDate(now);
    const yesterday = addDays(today, -1);
    const closings = await exec
        .select({
        date: dayClosings.date,
        closesAt: dayClosings.closesAt,
        closesNextDay: dayClosings.closesNextDay,
    })
        .from(dayClosings)
        .where(sql `${dayClosings.date} in (${today}, ${yesterday})`);
    const endOf = (closing) => bogotaInstant(closing.closesNextDay ? addDays(closing.date, 1) : closing.date, closing.closesAt);
    const overnight = closings.find((closing) => closing.date === yesterday && closing.closesNextDay);
    const previous = overnight && endOf(overnight) >= now ? overnight : undefined;
    const date = previous?.date ?? today;
    const closing = previous ?? closings.find((item) => item.date === date);
    const closingAt = closing ? endOf(closing) : null;
    const until = closingAt ?? bogotaInstant(addDays(date, 1), '00:00');
    // La parte posterior a medianoche de la jornada anterior no se vuelve a contar.
    const from = !previous && overnight ? endOf(overnight) : bogotaInstant(date, '00:00');
    const cutoff = new Date(Math.min(now.getTime(), until.getTime()));
    const [totals] = await exec
        .select({
        firstStartedAt: sql `min(${rentals.startedAt})`,
        count: sql `count(*) filter (where ${rentals.endedAt} is not null and ${rentals.endedAt} <= ${cutoff})`.mapWith(Number),
    })
        .from(rentals)
        .where(and(gte(rentals.startedAt, from), lt(rentals.startedAt, until), lte(rentals.startedAt, now)));
    return {
        date,
        count: totals?.count ?? 0,
        firstStartedAt: totals?.firstStartedAt ? new Date(totals.firstStartedAt).toISOString() : null,
        closedAt: closingAt && closingAt <= now ? closingAt.toISOString() : null,
    };
}
//# sourceMappingURL=dashboard.js.map