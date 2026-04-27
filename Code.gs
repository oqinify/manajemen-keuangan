const SHEET_NAME = 'Transactions';
const MASTER_SHEET_NAME = 'Master';
const FOLDER_NAME = 'Bukti Transaksi FinansialKu';

// Fungsi ini dijalankan pertama kali untuk membuat sheet jika belum ada
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Tanggal', 'Tipe', 'Output', 'Nominal', 'Metode Pembayaran', 'Sumber Dana', 'Keterangan', 'Bukti Transaksi (URL)', 'Reminder']);
    sheet.getRange("A1:J1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else {
    var range = sheet.getRange("A1:J1");
    range.setValues([['ID', 'Tanggal', 'Tipe', 'Output', 'Nominal', 'Metode Pembayaran', 'Sumber Dana', 'Keterangan', 'Bukti Transaksi (URL)', 'Reminder']]);
    range.setFontWeight("bold");
  }
  
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!masterSheet) {
    masterSheet = ss.insertSheet(MASTER_SHEET_NAME);
    masterSheet.appendRow(['Daftar Output', 'Metode Pembayaran', 'Sumber Dana']);
    masterSheet.getRange("A1:C1").setFontWeight("bold");
    masterSheet.setFrozenRows(1);
  } else {
    // Pastikan header diperbarui jika sheet sudah ada
    var range = masterSheet.getRange("A1:C1");
    range.setValues([['Daftar Output', 'Metode Pembayaran', 'Sumber Dana']]);
    range.setFontWeight("bold");
  }
}

// Fungsi GET untuk membaca data
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  
  if (!sheet || !masterSheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
    masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  }
  
  var data = sheet.getDataRange().getValues();
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] !== '') {
      // Format date as YYYY-MM-DD to avoid timezone offset issues
      var rawDate = row[1];
      var dateStr = '';
      if (rawDate instanceof Date) {
        var yyyy = rawDate.getFullYear();
        var mm = String(rawDate.getMonth() + 1).padStart(2, '0');
        var dd = String(rawDate.getDate()).padStart(2, '0');
        dateStr = yyyy + '-' + mm + '-' + dd;
      } else {
        dateStr = rawDate.toString();
      }

      result.push({
        id: row[0],
        date: dateStr,
        type: row[2],
        output: row[3],
        amount: Number(row[4]),
        paymentMethod: row[5],
        fundSource: row[6],
        description: row[7],
        receiptUrl: row[8],
        reminder: row[9] || null
      });
    }
  }
  
  // Baca master output, metode, dan sumber dana
  var masterData = masterSheet.getDataRange().getValues();
  var masterOutputs = [];
  var masterMethods = [];
  var masterSources = [];
  for (var j = 1; j < masterData.length; j++) {
    if (masterData[j][0] && masterData[j][0] !== '') {
      masterOutputs.push(masterData[j][0]);
    }
    if (masterData[j].length > 1 && masterData[j][1] && masterData[j][1] !== '') {
      masterMethods.push(masterData[j][1]);
    }
    if (masterData[j].length > 2 && masterData[j][2] && masterData[j][2] !== '') {
      masterSources.push(masterData[j][2]);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    transactions: result,
    masterOutputs: masterOutputs,
    masterMethods: masterMethods,
    masterSources: masterSources
  })).setMimeType(ContentService.MimeType.JSON);
}

// Fungsi POST untuk menambah, menghapus data
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  
  if (!sheet || !masterSheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
    masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  }

  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  
  if (action === 'add') {
    var t = body.data;
    var fileUrl = "";
    
    // Proses upload file jika ada Base64
    if (body.fileBase64) {
      fileUrl = uploadFileToDrive(body.fileBase64, body.fileMimeType, body.fileName);
    }
    
    sheet.appendRow([t.id, t.date, t.type, t.output, t.amount, t.paymentMethod, t.fundSource, t.description, fileUrl, t.reminder || ""]);
    
    // Tambahkan ke sheet Master jika belum ada
    if (t.output) updateMasterList(masterSheet, t.output, 0);
    if (t.paymentMethod) updateMasterList(masterSheet, t.paymentMethod, 1);
    if (t.fundSource) updateMasterList(masterSheet, t.fundSource, 2);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      fileUrl: fileUrl
    })).setMimeType(ContentService.MimeType.JSON);
  } 
  else if (action === 'edit') {
    var t = body.data;
    var idToEdit = t.id;
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() === idToEdit.toString()) {
        rowIndex = i + 1; // 1-based index for sheet
        break;
      }
    }
    
    if (rowIndex > -1) {
      var fileUrl = data[rowIndex - 1][8]; // keep existing URL by default
      
      if (body.isReceiptDeleted && fileUrl) {
        deleteFileFromDrive(fileUrl);
        fileUrl = "";
      }
      
      if (body.fileBase64) {
        fileUrl = uploadFileToDrive(body.fileBase64, body.fileMimeType, body.fileName);
      }
      
      sheet.getRange(rowIndex, 2, 1, 9).setValues([[t.date, t.type, t.output, t.amount, t.paymentMethod, t.fundSource, t.description, fileUrl, t.reminder || ""]]);
      
      if (t.output) updateMasterList(masterSheet, t.output, 0);
      if (t.paymentMethod) updateMasterList(masterSheet, t.paymentMethod, 1);
      if (t.fundSource) updateMasterList(masterSheet, t.fundSource, 2);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      fileUrl: fileUrl
    })).setMimeType(ContentService.MimeType.JSON);
  }
  else if (action === 'delete') {
    var idToDelete = body.id;
    var data = sheet.getDataRange().getValues();
    
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0].toString() === idToDelete.toString()) {
        var fileUrlToDelete = data[i][8];
        if (fileUrlToDelete) {
          deleteFileFromDrive(fileUrlToDelete);
        }
        sheet.deleteRow(i + 1);
        break;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  else if (action === 'clear') {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Action not found'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Fungsi Helper untuk menghapus file dari Drive
function deleteFileFromDrive(fileUrl) {
  try {
    if (!fileUrl || !fileUrl.includes("id=")) {
      // Jika formatnya bukan URL Drive dengan ID, coba ekstrak dari format lain
      // Format umum: https://drive.google.com/file/d/FILE_ID/view
      var fileId = "";
      if (fileUrl.includes("/d/")) {
        fileId = fileUrl.split("/d/")[1].split("/")[0];
      } else if (fileUrl.includes("id=")) {
        fileId = fileUrl.split("id=")[1].split("&")[0];
      }
      
      if (fileId) {
        DriveApp.getFileById(fileId).setTrashed(true);
      }
    } else {
       var fileId = fileUrl.split("id=")[1].split("&")[0];
       DriveApp.getFileById(fileId).setTrashed(true);
    }
  } catch (e) {
    console.error("Gagal menghapus file: " + e.toString());
  }
}

// Fungsi Helper untuk upload file agar lebih rapi dan ada logging
function uploadFileToDrive(base64Data, mimeType, fileName) {
  try {
    var decodedData = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedData, mimeType, fileName);
    
    var folder;
    var folders = DriveApp.getFoldersByName(FOLDER_NAME);
    
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(FOLDER_NAME);
      try {
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(e) {
        console.warn("Gagal mengatur sharing folder: " + e.message);
      }
    }
    
    var file = folder.createFile(blob);
    // Pastikan file juga bisa dilihat oleh semua yang punya link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}
    
    return file.getUrl();
  } catch (error) {
    console.error("Upload Error: " + error.toString());
    return "Error: " + error.toString();
  }
}

// Fungsi Tes Manual: Jalankan ini di editor GAS untuk tes apakah DriveApp bekerja
function testDriveAccess() {
  try {
    var folder = DriveApp.createFolder("TES_AKSES_DRIVE_" + new Date().getTime());
    var file = folder.createFile("test.txt", "DriveApp bekerja dengan baik!");
    console.log("Berhasil! File dibuat di: " + file.getUrl());
    return "Sukses";
  } catch (e) {
    console.error("Gagal Tes Drive: " + e.toString());
    return "Gagal: " + e.toString();
  }
}
// Helper untuk update daftar master (Output, Metode, Sumber Dana)
function updateMasterList(sheet, value, columnIndex) {
  var data = sheet.getDataRange().getValues();
  var valueTrimmed = value.toString().trim();
  var valueLower = valueTrimmed.toLowerCase();
  
  var exists = false;
  var lastRow = data.length;
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][columnIndex] && data[i][columnIndex].toString().toLowerCase() === valueLower) {
      exists = true;
      break;
    }
    // Cari baris kosong pertama di kolom ini
    if (targetRow === -1 && (!data[i][columnIndex] || data[i][columnIndex] === '')) {
      targetRow = i + 1;
    }
  }

  if (!exists) {
    if (targetRow === -1) {
      targetRow = lastRow + 1;
    }
    sheet.getRange(targetRow, columnIndex + 1).setValue(valueTrimmed);
  }
}
