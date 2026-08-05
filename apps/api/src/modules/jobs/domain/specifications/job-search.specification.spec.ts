import { JobStatus } from '@german-job-engine/shared-types';
import { JobSearchSpecification } from './job-search.specification';

describe('JobSearchSpecification', () => {
  it('applies defaults when no params are given', () => {
    const spec = JobSearchSpecification.create({});

    expect(spec.page).toBe(1);
    expect(spec.limit).toBe(20);
    expect(spec.offset).toBe(0);
    expect(spec.status).toBe(JobStatus.PUBLISHED);
  });

  it('clamps limit to the maximum of 100', () => {
    expect(JobSearchSpecification.create({ limit: 500 }).limit).toBe(100);
  });

  it('clamps page to a minimum of 1', () => {
    expect(JobSearchSpecification.create({ page: -5 }).page).toBe(1);
  });

  it('computes offset from page and limit', () => {
    const spec = JobSearchSpecification.create({ page: 3, limit: 10 });

    expect(spec.offset).toBe(20);
  });

  it('honors an explicit status filter', () => {
    const spec = JobSearchSpecification.create({ status: JobStatus.DRAFT });

    expect(spec.status).toBe(JobStatus.DRAFT);
  });

  it('trims keyword and city', () => {
    const spec = JobSearchSpecification.create({ keyword: '  engineer  ', city: '  Berlin  ' });

    expect(spec.keyword).toBe('engineer');
    expect(spec.city).toBe('Berlin');
  });
});
