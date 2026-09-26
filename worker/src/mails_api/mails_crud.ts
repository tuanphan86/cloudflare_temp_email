import { Context } from 'hono'

import i18n from '../i18n';
import { getBooleanValue } from '../utils';
import { handleMailListQuery, deleteAddressWithData, updateAddressUpdatedAt } from '../common'
import { resolveRawEmailRow } from '../gzip'
import { getSendBalanceState } from './send_balance';

const listMails = async (c: Context<HonoCustomType>) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { limit, offset } = c.req.query();
    if (Number.parseInt(offset) <= 0) updateAddressUpdatedAt(c, address);
    return await handleMailListQuery(c,
        `SELECT * FROM raw_mails where address = ?`,
        `SELECT count(*) as count FROM raw_mails where address = ?`,
        [address], limit, offset
    );
};

/**
 * PUBLIC MAIL VIEWER
 *
 * These helpers intentionally expose READ-ONLY mailbox access by address.
 * They do not create a JWT session and do not grant delete/send/settings rights.
 *
 * Security model:
 * - only addresses on configured DOMAINS are accepted
 * - address is normalized to lowercase
 * - public endpoints are GET-only
 */
const getConfiguredDomains = (c: Context<HonoCustomType>): string[] => {
    const raw = c.env.DOMAINS;

    if (!raw) return [];

    if (Array.isArray(raw)) {
        return raw
            .map((domain: unknown) => String(domain).trim().toLowerCase())
            .filter(Boolean);
    }

    if (typeof raw === 'string') {
        const value = raw.trim();

        if (!value) return [];

        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((domain: unknown) => String(domain).trim().toLowerCase())
                    .filter(Boolean);
            }
        } catch (_) {
            // Fall back to comma-separated/single-domain parsing below.
        }

        return value
            .split(',')
            .map((domain: string) => domain.trim().replace(/^["']|["']$/g, '').toLowerCase())
            .filter(Boolean);
    }

    return [];
};

const getPublicAddress = (c: Context<HonoCustomType>): string | null => {
    const rawAddress = c.req.query('address');

    if (!rawAddress) return null;

    const address = rawAddress.trim().toLowerCase();

    // Keep validation intentionally conservative.
    if (
        address.length > 254 ||
        !/^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address)
    ) {
        return null;
    }

    const atIndex = address.lastIndexOf('@');
    if (atIndex <= 0) return null;

    const domain = address.slice(atIndex + 1);
    const allowedDomains = getConfiguredDomains(c);

    if (allowedDomains.length === 0 || !allowedDomains.includes(domain)) {
        return null;
    }

    return address;
};

const publicListMails = async (c: Context<HonoCustomType>) => {
    const address = getPublicAddress(c);

    if (!address) {
        return c.json({ error: 'Invalid or unsupported address' }, 400);
    }

    const { limit, offset } = c.req.query();

    return await handleMailListQuery(
        c,
        `SELECT * FROM raw_mails WHERE lower(address) = ?`,
        `SELECT count(*) as count FROM raw_mails WHERE lower(address) = ?`,
        [address],
        limit,
        offset
    );
};

const publicGetMail = async (c: Context<HonoCustomType>) => {
    const address = getPublicAddress(c);

    if (!address) {
        return c.json({ error: 'Invalid or unsupported address' }, 400);
    }

    const { mail_id } = c.req.param();

    const result = await c.env.DB.prepare(
        `SELECT * FROM raw_mails WHERE id = ? AND lower(address) = ?`
    ).bind(mail_id, address).first();

    if (!result) return c.json(null);

    return c.json(await resolveRawEmailRow(result));
};

const updateMailReadStatus = async (c: Context<HonoCustomType>) => {
    if (!getBooleanValue(c.env.ENABLE_MAIL_READ_STATUS)) {
        return c.json({ error: 'Mail read status is disabled' }, 403);
    }
    const { address } = c.get("jwtPayload");
    const { id } = c.req.param();
    const { isUnread } = await c.req.json<{ isUnread?: boolean }>().catch(() => ({ isUnread: undefined }));
    if (typeof isUnread !== 'boolean') {
        return c.json({ error: 'isUnread must be a boolean' }, 400);
    }
    const value = isUnread ? 1 : 0;
    const { success } = await c.env.DB.prepare(
        `UPDATE raw_mails SET is_unread = ? WHERE id = ? AND address = ? AND COALESCE(is_unread, 0) != ?`
    ).bind(value, id, address, value).run();
    return c.json({ success });
};

const getMail = async (c: Context<HonoCustomType>) => {
    const { address } = c.get("jwtPayload")
    const { mail_id } = c.req.param();
    const result = await c.env.DB.prepare(
        `SELECT * FROM raw_mails where id = ? and address = ?`
    ).bind(mail_id, address).first();
    if (!result) return c.json(null);
    return c.json(await resolveRawEmailRow(result));
};

const deleteMail = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403)
    }
    const { address } = c.get("jwtPayload")
    const { id } = c.req.param();
    // TODO: add toLowerCase() to handle old data
    const { success } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ? and id = ? `
    ).bind(address.toLowerCase(), id).run();
    return c.json({ success });
};

const getSettings = async (c: Context<HonoCustomType>) => {
    const { address } = c.get("jwtPayload")

    updateAddressUpdatedAt(c, address);

    const { balance } = await getSendBalanceState(c, address);
    return c.json({
        address: address,
        send_balance: balance || 0,
    });
};

const deleteAddress = async (c: Context<HonoCustomType>) => {
    const { address, address_id } = c.get("jwtPayload")
    const success = await deleteAddressWithData(c, address, address_id);
    return c.json({ success });
};

const clearInbox = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403)
    }
    const { address } = c.get("jwtPayload")
    const { success } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ?`
    ).bind(address).run();
    if (!success) {
        return c.text(msgs.FailedClearInboxMsg, 500)
    }
    return c.json({ success });
};

const clearSentItems = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text(msgs.UserDeleteEmailDisabledMsg, 403)
    }
    const { address } = c.get("jwtPayload")
    const { success } = await c.env.DB.prepare(
        `DELETE FROM sendbox WHERE address = ?`
    ).bind(address).run();
    if (!success) {
        return c.text(msgs.FailedClearSentItemsMsg, 500)
    }
    return c.json({ success });
};

export default {
    listMails,
    getMail,
    publicListMails,
    publicGetMail,
    updateMailReadStatus,
    deleteMail,
    getSettings,
    deleteAddress,
    clearInbox,
    clearSentItems
};
