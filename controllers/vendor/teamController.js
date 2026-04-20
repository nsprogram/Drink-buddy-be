const Vendor = require('../../models/Vendor');

exports.list = async (req, res) => {
  res.json({ success: true, data: { team: req.vendor.team || [] } });
};

exports.invite = async (req, res) => {
  const { email, name, role } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'email required' });
  const v = await Vendor.findById(req.vendorId);
  if (v.team.find(m => m.email === email.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'Already on team' });
  }
  v.team.push({ email: email.toLowerCase(), name, role: role || 'staff', status: 'invited' });
  await v.save();
  res.status(201).json({ success: true, data: { team: v.team } });
};

exports.updateRole = async (req, res) => {
  const v = await Vendor.findById(req.vendorId);
  const m = v.team.id(req.params.memberId);
  if (!m) return res.status(404).json({ success: false, message: 'Not found' });
  if (req.body.role) m.role = req.body.role;
  if (req.body.status) m.status = req.body.status;
  await v.save();
  res.json({ success: true, data: { team: v.team } });
};

exports.remove = async (req, res) => {
  const v = await Vendor.findById(req.vendorId);
  const m = v.team.id(req.params.memberId);
  if (!m) return res.status(404).json({ success: false, message: 'Not found' });
  m.deleteOne();
  await v.save();
  res.json({ success: true, data: { team: v.team } });
};
