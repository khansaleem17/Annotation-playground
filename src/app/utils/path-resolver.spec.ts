import {
  hasCollectionPlaceholder,
  materializeCollectionPath,
  resolvePath,
  valueToRawString,
} from './path-resolver';

describe('path-resolver', () => {
  const taxReturn = {
    taxpayer: {
      legal: { firstName: 'Jane', lastName: 'Smith' },
      identifiers: { ssn: '123456789' },
    },
    dependents: [
      { legal: { firstName: 'Alex' }, identifiers: { ssn: '987654321' }, relationship: 'Son' },
      { legal: { firstName: 'Mia' }, identifiers: { ssn: '456789123' }, relationship: 'Daughter' },
    ],
    income: {
      w2Forms: [{ employer: { name: 'Acme Corporation', ein: '12-3456789' }, wages: 78500 }],
      interest: { taxable: 1250.5 },
    },
    filingStatus: { single: true },
  };

  it('resolves a deeply nested property path', () => {
    expect(resolvePath(taxReturn, '$.taxpayer.legal.firstName')).toBe('Jane');
    expect(resolvePath(taxReturn, '$.taxpayer.identifiers.ssn')).toBe('123456789');
  });

  it('resolves array indexes into nested objects', () => {
    expect(resolvePath(taxReturn, '$.dependents[0].identifiers.ssn')).toBe('987654321');
    expect(resolvePath(taxReturn, '$.dependents[1].relationship')).toBe('Daughter');
    expect(resolvePath(taxReturn, '$.income.w2Forms[0].wages')).toBe(78500);
  });

  it('returns undefined for missing paths', () => {
    expect(resolvePath(taxReturn, '$.taxpayer.middleName')).toBeUndefined();
    expect(resolvePath(taxReturn, '$.dependents[9].legal.firstName')).toBeUndefined();
  });

  it('materializes collection placeholders', () => {
    const template = '$.dependents[].legal.firstName';
    expect(hasCollectionPlaceholder(template)).toBe(true);
    expect(materializeCollectionPath(template, 1)).toBe('$.dependents[1].legal.firstName');
    expect(resolvePath(taxReturn, materializeCollectionPath(template, 1))).toBe('Mia');
  });

  it('stringifies primitives for display', () => {
    expect(valueToRawString(true)).toBe('true');
    expect(valueToRawString(1250.5)).toBe('1250.5');
    expect(valueToRawString(null)).toBe('');
  });
});
