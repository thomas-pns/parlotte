// Pose l'icône et les informations de version sur Parlotte.exe, sans Wine.
import * as ResEdit from 'resedit';
import * as PELibrary from 'pe-library';
import fs from 'fs';
const exePath = process.argv[2], icoPath = process.argv[3];
const version = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url))).version, [a, b, c] = version.split('.').map(Number);
const exe = PELibrary.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = PELibrary.NtExecutableResource.from(exe);
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const groupId = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, iconFile.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
vi.setStringValues({ lang: 1033, codepage: 1200 }, {
  FileDescription: 'Parlotte', ProductName: 'Parlotte', CompanyName: 'Parlotte', LegalCopyright: 'Parlotte',
  OriginalFilename: 'Parlotte.exe', InternalName: 'Parlotte', FileVersion: version, ProductVersion: version,
});
vi.outputToResourceEntries(res.entries);
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('icône et version posées sur', exePath);
