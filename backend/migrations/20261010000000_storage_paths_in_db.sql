-- +migrate Up
-- DB hanya menyimpan KEY storage ("events/banners/2026/10/123-banner.jpg"),
-- bukan URL. URL publik dirakit saat response memakai GOKIL_STORAGE_BASE_URL
-- (internal/storageutil/path.go), sehingga pindah domain/port/bucket tidak
-- merusak data lama.
--
-- Migrasi ini menormalkan nilai lama: URL absolut (base URL deployment/era
-- sebelumnya, termasuk segmen bucket path-style) dan path relatif
-- "/storage/<key>" era provider `local` diubah menjadi key saja. Nilai yang
-- tidak dikenali bentuknya dibiarkan apa adanya — kegagalan yang aman, karena
-- pembaca (storageutil.ReadStored) masih menangani URL absolut.

CREATE OR REPLACE FUNCTION myorg_storage_key_to_path(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v IS NULL OR v = '' OR v LIKE 'data:%' THEN v
    WHEN v LIKE '/storage/%' THEN substr(v, 10)
    WHEN v ~ '^https?://' THEN regexp_replace(
      v,
      '^https?://[^/]+/(?:[^/]+/)?((announcements|events|finance|letters|letter-templates|settings|avatars|attendance|permissions|storage)/.*)$',
      '\1')
    ELSE v
  END
$$;

UPDATE organization_settings SET logo_url = myorg_storage_key_to_path(logo_url) WHERE logo_url <> myorg_storage_key_to_path(logo_url);
UPDATE organization_settings SET icon_url = myorg_storage_key_to_path(icon_url) WHERE icon_url <> myorg_storage_key_to_path(icon_url);
UPDATE "user"                SET avatar_url = myorg_storage_key_to_path(avatar_url) WHERE avatar_url <> myorg_storage_key_to_path(avatar_url);
UPDATE event                 SET banner_url = myorg_storage_key_to_path(banner_url) WHERE banner_url <> myorg_storage_key_to_path(banner_url);
UPDATE attendance            SET selfie_url = myorg_storage_key_to_path(selfie_url) WHERE selfie_url <> myorg_storage_key_to_path(selfie_url);
UPDATE attendance            SET signature_url = myorg_storage_key_to_path(signature_url) WHERE signature_url <> myorg_storage_key_to_path(signature_url);
UPDATE permission_request    SET proof_url = myorg_storage_key_to_path(proof_url) WHERE proof_url <> myorg_storage_key_to_path(proof_url);
UPDATE violation             SET document_url = myorg_storage_key_to_path(document_url) WHERE document_url <> myorg_storage_key_to_path(document_url);
UPDATE letter_template       SET template_url = myorg_storage_key_to_path(template_url) WHERE template_url <> myorg_storage_key_to_path(template_url);
UPDATE letter                SET attachment_url = myorg_storage_key_to_path(attachment_url) WHERE attachment_url <> myorg_storage_key_to_path(attachment_url);
UPDATE letter                SET document_url = myorg_storage_key_to_path(document_url) WHERE document_url <> myorg_storage_key_to_path(document_url);
UPDATE announcement          SET banner_url = myorg_storage_key_to_path(banner_url) WHERE banner_url <> myorg_storage_key_to_path(banner_url);
UPDATE announcement_attachment SET file_url = myorg_storage_key_to_path(file_url) WHERE file_url <> myorg_storage_key_to_path(file_url);
UPDATE finance_transaction   SET receipt_url = myorg_storage_key_to_path(receipt_url) WHERE receipt_url <> myorg_storage_key_to_path(receipt_url);
UPDATE storage_file          SET file_url = myorg_storage_key_to_path(file_url) WHERE file_url <> myorg_storage_key_to_path(file_url);

DROP FUNCTION myorg_storage_key_to_path(text);

-- +migrate Down
-- Tidak ada rollback: URL lama bergantung pada GOKIL_STORAGE_BASE_URL yang
-- berlaku saat itu, dan nilainya tidak tersimpan lagi setelah normalisasi.
-- Aplikasi tetap membangun URL dari key, jadi keadaan ini konsisten.
SELECT 1;
