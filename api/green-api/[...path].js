import { handleNodeRequest } from '../../server/greenProxy.mjs';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 30,
};

export default function handler(req, res) {
  return handleNodeRequest(req, res);
}
