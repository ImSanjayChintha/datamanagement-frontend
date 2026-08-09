import { post } from '@/core/api';
import type {
  PushDestination,
  PushDestinationsListResult,
  PushDestinationsListParams,
  CreatePushDestination,
  UpdatePushDestination,
  TestResult,
} from '@/types/destinations';

export const pushDestsApi = {
  list:   (p?: PushDestinationsListParams)         => post<PushDestinationsListResult>('/admin/push-destinations/list', p ?? {}),
  get:    (id: number)                             => post<PushDestination>('/admin/push-destinations/get', { id }),
  create: (data: CreatePushDestination)            => post<PushDestination>('/admin/push-destinations/create', data),
  update: (data: UpdatePushDestination)            => post<PushDestination>('/admin/push-destinations/update', data),
  delete: (id: number)                             => post<{ deleted: boolean }>('/admin/push-destinations/delete', { id }),
  test:   (id: number)                             => post<TestResult>('/admin/push-destinations/test', { id }),
};
