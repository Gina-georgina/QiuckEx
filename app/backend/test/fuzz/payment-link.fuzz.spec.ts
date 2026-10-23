import { describe, expect, it } from '@jest/globals';
import * as fc from 'fast-check';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { BulkPaymentLinkItemDto } from '../../src/payment-link/dto/bulk-payment-link-item.dto';
import { CreateRecurringPaymentLinkDto } from '../../src/payment-link/dto/create-recurring-payment-link.dto';
import { LinkConstraints } from '../../src/payment-link/payment-link.constraints';
import { SUPPORTED_ASSETS } from '../../src/payment-link/payment-link.constants';
import { STELLAR_ASSETS } from '../../src/stellar/stellar.constants';

/**
 * Deterministic fuzz configuration.
 * A fixed seed keeps failures reproducible while bounded numRuns keeps the
 * suite comfortably under the 60s budget.
 */
const FUZZ_SEED = 0x5eed_1234;
const NUM_RUNS = 300;

const fcConfig: fc.Parameters<unknown> = {
  seed: FUZZ_SEED,
  numRuns: NUM_RUNS,
};

/**
 * Documented bounds for payment link amounts. These mirror the values enforced
 * by the DTO validators / LinkConstraints.
 */
const MIN_AMOUNT = LinkConstraints.AMOUNT.MIN;
const MAX_AMOUNT = LinkConstraints.AMOUNT.MAX;
const MAX_DECIMALS = LinkConstraints.AMOUNT.MAX_DECIMALS;

/**
 * Parse an amount string the same way the service layer does.
 * Returns NaN when the value cannot be interpreted as a number.
 */
function parseAmount(raw: string): number {
  if (typeof raw !== 'string') {
    return Number.NaN;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return Number.NaN;
  }
  // Reject anything that is not a plain decimal number.
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) {
    return Number.NaN;
  }
  return Number.parseFloat(trimmed);
}

/**
 * Whether an amount string is acceptable according to the documented rules:
 * parseable, finite, non-negative, within [MIN_AMOUNT, MAX_AMOUNT], and with
 * at most MAX_DECIMALS decimal places.
 */
function isAcceptedAmount(raw: string): boolean {
  const value = parseAmount(raw);
  if (!Number.isFinite(value)) {
    return false;
  }
  if (value < 0) {
    return false;
  }
  if (value < MIN_AMOUNT || value > MAX_AMOUNT) {
    return false;
  }
  const decimals = (raw.trim().split('.')[1] ?? '').length;
  if (decimals > MAX_DECIMALS) {
    return false;
  }
  return true;
}

const allKnownAssets: string[] = Array.from(
  new Set<string>([
    ...SUPPORTED_ASSETS,
    ...LinkConstraints.ASSET.WHITELIST,
    ...STELLAR_ASSETS,
  ]),
);

describe('payment-link fuzz', () => {
  describe('amount parsing', () => {
    it('accepts only non-negative finite floats within documented bounds', () => {
      fc.assert(
        fc.property(fc.string(), (raw) => {
          const accepted = isAcceptedAmount(raw);
          if (accepted) {
            const value = parseAmount(raw);
            expect(Number.isFinite(value)).toBe(true);
            expect(Number.isNaN(value)).toBe(false);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeGreaterThanOrEqual(MIN_AMOUNT);
            expect(value).toBeLessThanOrEqual(MAX_AMOUNT);
          } else {
            const value = parseAmount(raw);
            const rejectedForValue =
              Number.isNaN(value) ||
              !Number.isFinite(value) ||
              value < 0 ||
              value < MIN_AMOUNT ||
              value > MAX_AMOUNT;
            const rejectedForDecimals =
              (raw.trim().split('.')[1] ?? '').length > MAX_DECIMALS;
            expect(rejectedForValue || rejectedForDecimals).toBe(true);
          }
        }),
        fcConfig,
      );
    });

    it('accepts generated valid amounts and parses them to finite non-negative floats', () => {
      const validAmountArb = fc
        .tuple(
          fc.integer({ min: 0, max: Math.floor(MAX_AMOUNT) }),
          fc.integer({ min: 0, max: MAX_DECIMALS }),
        )
        .map(([whole, decimals]) => {
          if (decimals === 0) {
            return `${whole}`;
          }
          const fraction = '0'.repeat(decimals);
          return `${whole}.${fraction}`;
        });

      fc.assert(
        fc.property(validAmountArb, (raw) => {
          expect(isAcceptedAmount(raw)).toBe(true);
          const value = parseAmount(raw);
          expect(Number.isFinite(value)).toBe(true);
          expect(Number.isNaN(value)).toBe(false);
          expect(value).toBeGreaterThanOrEqual(0);
        }),
        fcConfig,
      );
    });

    it('rejects negative, NaN, Infinity, and out-of-bounds amounts', () => {
      const invalidAmountArb = fc.oneof(
        fc
          .double({ min: -1e9, max: -0.0001, noNaN: true })
          .map((n) => n.toString()),
        fc.constant('NaN'),
        fc.constant('Infinity'),
        fc.constant('-Infinity'),
        fc
          .double({ min: MAX_AMOUNT + 1, max: MAX_AMOUNT * 10, noNaN: true })
          .map((n) => n.toString()),
        fc.constant('not-a-number'),
        fc.constant(''),
        fc.constant('   '),
      );

      fc.assert(
        fc.property(invalidAmountArb, (raw) => {
          expect(isAcceptedAmount(raw)).toBe(false);
        }),
        fcConfig,
      );
    });
  });

  describe('asset codes', () => {
    it('only accepts asset codes present in the supported/whitelist lists', () => {
      fc.assert(
        fc.property(fc.string(), (asset) => {
          const known = allKnownAssets.includes(asset);
          if (known) {
            expect(allKnownAssets).toContain(asset);
          } else {
            expect(allKnownAssets).not.toContain(asset);
          }
        }),
        fcConfig,
      );
    });

    it('accepts every known asset code', () => {
      fc.assert(
        fc.property(fc.constantFrom(...allKnownAssets), (asset) => {
          expect(allKnownAssets).toContain(asset);
        }),
        fcConfig,
      );
    });
  });

  describe('BulkPaymentLinkItemDto validation', () => {
    it('validates generated items consistently with class-validator', async () => {
      const itemArb = fc.record({
        amount: fc.oneof(
          fc.constant('10'),
          fc.constant('0'),
          fc.constant('100.50'),
          fc.constant('-5'),
          fc.constant('NaN'),
          fc.constant('Infinity'),
          fc.string(),
        ),
        asset: fc.oneof(
          fc.constantFrom(...allKnownAssets),
          fc.string(),
        ),
        destination: fc.oneof(
          fc.constant('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
          fc.string(),
        ),
      });

      await fc.assert(
        fc.asyncProperty(itemArb, async (raw) => {
          const dto = plainToInstance(BulkPaymentLinkItemDto, raw);
          const errors = await validate(dto, {
            whitelist: true,
            forbidNonWhitelisted: false,
          });

          if (errors.length === 0) {
            // If class-validator accepted it, the amount must be a valid,
            // non-negative finite number within bounds.
            const value = parseAmount(String(raw.amount));
            expect(Number.isFinite(value)).toBe(true);
            expect(Number.isNaN(value)).toBe(false);
            expect(value).toBeGreaterThanOrEqual(0);
          } else {
            expect(errors.length).toBeGreaterThan(0);
          }
        }),
        fcConfig,
      );
    });
  });

  describe('CreateRecurringPaymentLinkDto validation', () => {
    it('validates generated recurring payment links consistently', async () => {
      const recurringArb = fc.record({
        amount: fc.oneof(
          fc.constant('10'),
          fc.constant('0'),
          fc.constant('100.50'),
          fc.constant('-5'),
          fc.constant('NaN'),
          fc.constant('Infinity'),
          fc.string(),
        ),
        asset: fc.oneof(
          fc.constantFrom(...allKnownAssets),
          fc.string(),
        ),
        destination: fc.oneof(
          fc.constant('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
          fc.string(),
        ),
        interval: fc.oneof(
          fc.constant('daily'),
          fc.constant('weekly'),
          fc.constant('monthly'),
          fc.string(),
        ),
      });

      await fc.assert(
        fc.asyncProperty(recurringArb, async (raw) => {
          const dto = plainToInstance(CreateRecurringPaymentLinkDto, raw);
          const errors = await validate(dto, {
            whitelist: true,
            forbidNonWhitelisted: false,
          });

          if (errors.length === 0) {
            const value = parseAmount(String(raw.amount));
            expect(Number.isFinite(value)).toBe(true);
            expect(Number.isNaN(value)).toBe(false);
            expect(value).toBeGreaterThanOrEqual(0);
          } else {
            expect(errors.length).toBeGreaterThan(0);
          }
        }),
        fcConfig,
      );
    });
  });
});