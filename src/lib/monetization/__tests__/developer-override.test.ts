/**
 * Developer Override Tests
 * CLEAN: Comprehensive testing of developer override functionality
 * MODULAR: Isolated test cases for each feature
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getDeveloperOverride, 
  setDeveloperOverride, 
  clearDeveloperOverride 
} from '../revenueCatConfig';

describe('Developer Override System', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getDeveloperOverride', () => {
    it('should return disabled override by default', () => {
      const override = getDeveloperOverride();
      expect(override.enabled).toBe(false);
      expect(override.tier).toBe('basic');
      expect(override.features).toEqual([]);
    });

    it('should return localStorage override when set', () => {
      const testOverride = {
        tier: 'premium',
        features: ['ai_analysis', 'ai_coaching'],
        timestamp: Date.now()
      };
      
      localStorage.setItem('brume-dev-override', JSON.stringify(testOverride));
      
      const override = getDeveloperOverride();
      expect(override.enabled).toBe(true);
      expect(override.tier).toBe('premium');
      expect(override.features).toEqual(['ai_analysis', 'ai_coaching']);
      expect(override.reason).toBe('Local developer override');
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem('brume-dev-override', 'invalid-json');
      
      const override = getDeveloperOverride();
      expect(override.enabled).toBe(false);
    });
  });

  describe('setDeveloperOverride', () => {
    it('should set basic tier override', () => {
      setDeveloperOverride('basic');
      
      const override = getDeveloperOverride();
      expect(override.enabled).toBe(true);
      expect(override.tier).toBe('basic');
      expect(override.features).toEqual(['all']);
    });

    it('should set premium tier override', () => {
      setDeveloperOverride('premium');
      
      const override = getDeveloperOverride();
      expect(override.enabled).toBe(true);
      expect(override.tier).toBe('premium');
      expect(override.features).toEqual(['all']);
    });

    it('should set pro tier override', () => {
      setDeveloperOverride('pro');
      
      const override = getDeveloperOverride();
      expect(override.enabled).toBe(true);
      expect(override.tier).toBe('pro');
      expect(override.features).toEqual(['all']);
    });

    it('should set custom features', () => {
      setDeveloperOverride('premium', ['ai_analysis', 'cloud_sync']);
      
      const override = getDeveloperOverride();
      expect(override.enabled).toBe(true);
      expect(override.tier).toBe('premium');
      expect(override.features).toEqual(['ai_analysis', 'cloud_sync']);
    });
  });

  describe('clearDeveloperOverride', () => {
    it('should clear existing override', () => {
      setDeveloperOverride('pro');
      expect(getDeveloperOverride().enabled).toBe(true);
      
      clearDeveloperOverride();
      expect(getDeveloperOverride().enabled).toBe(false);
    });

    it('should be safe to call when no override exists', () => {
      expect(() => clearDeveloperOverride()).not.toThrow();
      expect(getDeveloperOverride().enabled).toBe(false);
    });
  });
});