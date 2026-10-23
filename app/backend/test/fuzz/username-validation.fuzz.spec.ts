import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import fc from 'fast-check';
import { CreateUsernameDto } from '../../src/users/dto/create-username.dto';
import { ClaimUsernameDto } from '../../src/users/dto/claim-username.dto';

const NUM_RUNS = 300;
const SEED = 20240101;

const ALLOWED_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789_';

// A syntactically valid Stellar public key (56 chars, base32 alphabet, starts with G).
const VALID_STELLAR_PUBLIC_KEY =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const allowedUsernameArb = fc
  .array(fc.constantFrom(...ALLOWED_ALPHABET.split('')), {
    minLength: 3,
    maxLength: 32,
  })
  .map((chars) => chars.join(''));

const disallowedCharArb = fc.constantFrom(
  'A',
  'Z',
  '-',
  ' ',
  '.',
  '@',
  '/',
  '\\',
  '\t',
  '\n',
  '\r',
  '\u0000',
  '\u001f',
  '\u007f',
  'é',
  'ü',
  '中',
  '😀',
  '+',
  '=',
  '~',
  '!',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
);

const tooShortArb = fc
  .array(fc.constantFrom(...ALLOWED_ALPHABET.split('')), {
    minLength: 0,
    maxLength: 2,
  })
  .map((chars) => chars.join(''));

const tooLongArb = fc
  .array(fc.constantFrom(...ALLOWED_ALPHABET.split('')), {
    minLength: 33,
    maxLength: 64,
  })
  .map((chars) => chars.join(''));

const usernameWithDisallowedCharArb = fc
  .tuple(
    fc.array(fc.constantFrom(...ALLOWED_ALPHABET.split('')), {
      minLength: 0,
      maxLength: 10,
    }),
    disallowedCharArb,
    fc.array(fc.constantFrom(...ALLOWED_ALPHABET.split('')), {
      minLength: 0,
      maxLength: 10,
    }),
  )
  .map(([prefix, bad, suffix]) => `${prefix.join('')}${bad}${suffix.join('')}`);

const nonStringArb = fc.oneof(
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.string()),
  fc.dictionary(fc.string(), fc.string()),
  fc.constant({}),
);

async function validateCreateUsername(payload: unknown) {
  const dto = plainToInstance(CreateUsernameDto, payload as object);
  return validate(dto as object);
}

async function validateClaimUsername(payload: unknown) {
  const dto = plainToInstance(ClaimUsernameDto, payload as object);
  return validate(dto as object);
}

describe('username validation fuzz', () => {
  jest.setTimeout(55000);

  describe('CreateUsernameDto', () => {
    it('accepts usernames from the allowed alphabet with length 3-32', async () => {
      await fc.assert(
        fc.asyncProperty(allowedUsernameArb, async (username) => {
          const errors = await validateCreateUsername({ username });
          expect(errors).toHaveLength(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects usernames containing disallowed characters', async () => {
      await fc.assert(
        fc.asyncProperty(usernameWithDisallowedCharArb, async (username) => {
          const errors = await validateCreateUsername({ username });
          expect(errors.length).toBeGreaterThan(0);
          const constraints = errors.flatMap((e) =>
            Object.keys(e.constraints ?? {}),
          );
          expect(constraints.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects usernames that are too short', async () => {
      await fc.assert(
        fc.asyncProperty(tooShortArb, async (username) => {
          const errors = await validateCreateUsername({ username });
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects usernames that are too long', async () => {
      await fc.assert(
        fc.asyncProperty(tooLongArb, async (username) => {
          const errors = await validateCreateUsername({ username });
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects non-string usernames', async () => {
      await fc.assert(
        fc.asyncProperty(nonStringArb, async (username) => {
          const errors = await validateCreateUsername({ username });
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });
  });

  describe('ClaimUsernameDto', () => {
    it('accepts usernames from the allowed alphabet with length 3-32 and a valid public key', async () => {
      await fc.assert(
        fc.asyncProperty(allowedUsernameArb, async (username) => {
          const errors = await validateClaimUsername({
            username,
            publicKey: VALID_STELLAR_PUBLIC_KEY,
          });
          expect(errors).toHaveLength(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects usernames containing disallowed characters', async () => {
      await fc.assert(
        fc.asyncProperty(usernameWithDisallowedCharArb, async (username) => {
          const errors = await validateClaimUsername({
            username,
            publicKey: VALID_STELLAR_PUBLIC_KEY,
          });
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects usernames that are too short', async () => {
      await fc.assert(
        fc.asyncProperty(tooShortArb, async (username) => {
          const errors = await validateClaimUsername({
            username,
            publicKey: VALID_STELLAR_PUBLIC_KEY,
          });
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects usernames that are too long', async () => {
      await fc.assert(
        fc.asyncProperty(tooLongArb, async (username) => {
          const errors = await validateClaimUsername({
            username,
            publicKey: VALID_STELLAR_PUBLIC_KEY,
          });
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });

    it('rejects non-string usernames', async () => {
      await fc.assert(
        fc.asyncProperty(nonStringArb, async (username) => {
          const errors = await validateClaimUsername({
            username,
            publicKey: VALID_STELLAR_PUBLIC_KEY,
          });
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS, seed: SEED },
      );
    });
  });
});