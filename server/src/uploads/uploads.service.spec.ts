import { NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

type PrismaArg = ConstructorParameters<typeof UploadsService>[0];
type ConfigArg = ConstructorParameters<typeof UploadsService>[1];

function makeService(uploadFindUnique: jest.Mock) {
  const prisma = { upload: { create: jest.fn(), findUnique: uploadFindUnique } };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new UploadsService(
    prisma as unknown as PrismaArg,
    config as unknown as ConfigArg,
  );
  return { service, prisma };
}

describe('UploadsService', () => {
  it('store() rejects a non-image before writing anything', async () => {
    const { service, prisma } = makeService(jest.fn());
    await expect(service.store('u1', Buffer.from('not an image at all!!'))).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(prisma.upload.create).not.toHaveBeenCalled();
  });

  it('read() throws 404 for an unknown id', async () => {
    const { service } = makeService(jest.fn().mockResolvedValue(null));
    await expect(service.read('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
