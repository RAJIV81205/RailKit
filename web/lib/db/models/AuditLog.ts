import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  trainNo: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },
  userAgent: {
    type: String,
    default: null,
    trim: true,
  },
  referer: {
    type: String,
    default: null,
    trim: true,
  },
  statusCode: {
    type: Number,
    required: true,
  },
  path: {
    type: String,
    required: true,
    trim: true,
  },
  ip: {
    type: String,
    required: true,
    trim: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  source: {
    type: String,
    enum: ['SDK', 'API'],
    required: true,
    default: 'API',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

auditLogSchema.index({ email: 1, trainNo: 1, createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
