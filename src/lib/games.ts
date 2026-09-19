import { asc, count, eq } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export const DEFAULT_GAMES_PAGE_SIZE = 6;

export interface GamesPageOptions {
    page: number;
    limit: number;
}

export interface GamesPageResult {
    games: Game[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function normalizePage(page: number): number {
    if (!Number.isInteger(page) || page < 1) {
        return 1;
    }
    return page;
}

function normalizeLimit(limit: number): number {
    if (!Number.isInteger(limit) || limit < 1) {
        return DEFAULT_GAMES_PAGE_SIZE;
    }
    return Math.min(limit, 50);
}

export async function getTotalGameCount(db: Database): Promise<number> {
    const [row] = await db.select({ count: count() }).from(games);
    return Number(row?.count ?? 0);
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** Fetch a single page of games ordered by title, with pagination metadata. */
export async function getGamesPage(db: Database, options: Partial<GamesPageOptions> = {}): Promise<GamesPageResult> {
    const limit = normalizeLimit(options.limit ?? DEFAULT_GAMES_PAGE_SIZE);
    const totalCount = await getTotalGameCount(db);
    const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / limit);
    const page = Math.min(normalizePage(options.page ?? 1), totalPages);
    const offset = (page - 1) * limit;
    const rows = await baseGamesQuery(db).orderBy(asc(games.title)).limit(limit).offset(offset);

    return {
        games: rows.map(mapGame),
        totalCount,
        page,
        limit,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
    };
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
