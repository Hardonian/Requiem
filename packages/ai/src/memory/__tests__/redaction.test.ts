/**
 * @fileoverview Redaction Tests
 * 
 * Tests that intentionally inject fake secrets to verify redaction works.
 */

import { describe, it, expect } from '@jest/globals';
import { 
  redactString, 
  redactObject, 
  redactEnv, 
  containsSecrets,
  getFakeSecrets,
  redactConfig 
} from '../redaction';

describe('Redaction', () => {
  describe('redactString', () => {
    it('should redact API keys', () => {
      const input = 'api_key=sk_test_51H7f8Q8K2vL3mN4pQ5rS6tU7vW8xY9zA';
      const result = redactString(input);
      expect(result).not.toContain('sk_test');
    });

    it('should redact bearer tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const result = redactString(input);
      expect(result).not.toContain('eyJ');
    });

    it('should redact email addresses', () => {
      const input = 'Contact: test@example.com';
      const result = redactString(input);
      expect(result).not.toContain('@');
    });

    it('should redact credit card numbers', () => {
      const input = 'Card: 4111-1111-1111-1111';
      const result = redactString(input);
      expect(result).not.toContain('4111');
    });

    it('should redact SSN', () => {
      const input = 'SSN: 123-45-6789';
      const result = redactString(input);
      expect(result).not.toContain('123-45');
    });

    it('should redact JWT tokens', () => {
      const input = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
      const result = redactString(input);
      expect(result).toContain('[REDACTED_JWT]');
    });

    it('should redact AWS keys', () => {
      const input = 'AKIAIOSFODNN7EXAMPLE';
      const result = redactString(input);
      expect(result).not.toContain('AKIA');
    });

    it('should redact GitHub tokens', () => {
      const input = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';
      const result = redactString(input);
      expect(result).not.toContain('ghp_');
    });

    it('should redact database connection strings', () => {
      const input = 'postgresql://user:password@localhost:5432/mydb';
      const result = redactString(input);
      expect(result).not.toContain('password');
    });
  });

  describe('redactObject', () => {
    it('should redact all string values in an object', () => {
      const input = {
        name: 'test',
        api_key: 'sk_test_1234567890',
        data: {
          token: 'bearer_token_123',
          nested: {
            secret: 'my_secret_key'
          }
        }
      };
      
      const result = redactObject(input);
      
      expect(result).toMatchObject({
        name: 'test',
        api_key: '[REDACTED]',
        data: {
          token: '[REDACTED]',
          nested: {
            secret: '[REDACTED]'
          }
        }
      });
    });

    it('should redact array values', () => {
      const input = {
        items: [
          { key: 'api_key_1' },
          { key: 'api_key_2' }
        ]
      };
      
      const result = redactObject(input);
      
      expect(result).toMatchObject({
        items: [
          { key: '[REDACTED]' },
          { key: '[REDACTED]' }
        ]
      });
    });

    it('should handle primitive values', () => {
      expect(redactObject('test_string')).toBe('test_string');
      expect(redactObject(123)).toBe(123);
      expect(redactObject(true)).toBe(true);
      expect(redactObject(null)).toBe(null);
      expect(redactObject(undefined)).toBe(undefined);
    });
  });

  describe('redactEnv', () => {
    it('should redact secret environment variables', () => {
      const env = {
        PATH: '/usr/bin',
        HOME: '/home/user',
        REQUIEM_API_KEY: 'sk_test_123',
        DATABASE_PASSWORD: 'my_secret',
        USER_TOKEN: 'bearer_abc123'
      };
      
      const result = redactEnv(env);
      
      expect(result.PATH).toBe('/usr/bin');
      expect(result.HOME).toBe('/home/user');
      expect(result.REQUIEM_API_KEY).toBe('[REDACTED]');
      expect(result.DATABASE_PASSWORD).toBe('[REDACTED]');
      expect(result.USER_TOKEN).toBe('[REDACTED]');
    });
  });

  describe('containsSecrets', () => {
    it('should detect secrets in string', () => {
      expect(containsSecrets('sk_test_1234567890')).toBe(true);
      expect(containsSecrets('test@example.com')).toBe(true);
      expect(containsSecrets('4111-1111-1111-1111')).toBe(true);
      expect(containsSecrets('normal text')).toBe(false);
    });
  });

  describe('getFakeSecrets', () => {
    it('should return test secrets', () => {
      const secrets = getFakeSecrets();
      
      expect(secrets.api_key).toBeDefined();
      expect(secrets.bearer_token).toBeDefined();
      expect(secrets.email).toBeDefined();
      expect(secrets.credit_card).toBeDefined();
      expect(secrets.ssn).toBeDefined();
      expect(secrets.aws_key).toBeDefined();
      expect(secrets.github_token).toBeDefined();
      expect(secrets.db_connection).toBeDefined();
    });
  });

  describe('redactConfig', () => {
    it('should redact sensitive config values', () => {
      const config = {
        name: 'my-app',
        apiKey: 'secret_key_123',
        database: {
          host: 'localhost',
          password: 'db_password'
        },
        features: {
          enabled: true
        }
      };
      
      const result = redactConfig(config);
      
      expect(result.name).toBe('my-app');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.database).toMatchObject({
        host: 'localhost',
        password: '[REDACTED]'
      });
      expect(result.features).toMatchObject({
        enabled: true
      });
    });
  });
});
