const SuperAdmin = require("../models/SuperAdmin");
const Admin = require("../models/Admin");
const Users = require("../models/User");

const { StatusCodes } = require("http-status-codes");
const { param } = require("../routes/openAPIRoute");

const getAllParametersController = async (req, res) => {
  try {
    const parameters = await SuperAdmin.getAllParameters();
    const formattedParameters = parameters[0].map((para) => ({
      paraKey: para.para_key,
      paraName: para.para_name,
      paraUnit: para.para_unit,
    }));
    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedParameters,
    });
  } catch (error) {
    console.error("Error fetching parameters:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch parameters",
      error: error.message || error,
    });
  }
};

const getTableStructureController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID is required",
      });
    }
    const tableStructure = await SuperAdmin.getTableStructure(deviceId);
    const formattedTableStructure = tableStructure[0]
      .map((col, index) => {
        if (
          col.Field === "_id" ||
          col.Field === "lg" ||
          col.Field === "lt" ||
          col.Field === "bv" ||
          col.Field === "ts_client" ||
          col.Field === "ts_server"
        ) {
          return;
        }
        return {
          id: index + 1,
          columnName: col.Field,
          type: col.Type.split("(")[0],
          size: col.Type.match(/\d+/)
            ? parseInt(col.Type.match(/\d+/)[0])
            : null,
          null: col.Null,
          key: col.Key,
          default: col.Default,
          extra: col.Extra,
        };
      })
      .filter(Boolean);

    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedTableStructure,
    });
  } catch (error) {
    console.error("Error fetching table structure:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch table structure",
      error: error.message || error,
    });
  }
};
const setTableStructureController = async (req, res) => {
  try {
    const { email } = req.user;
    const { deviceId } = req.query;
    const columns = req.body;

    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID is required",
      });
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Column definitions must be a non-empty array",
      });
    }

    // Validate all column inputs
    for (const col of columns) {
      if (!col.columnName || !col.type || !col.size || !col.after) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Each column must have columnName, type, size, and after",
        });
      }
    }

    // Get existing column names
    const existingCols = await SuperAdmin.getExisting(deviceId);
    const existingColNames = existingCols[0].map((col) => col.Field);

    // Filter out columns that already exist
    const newColumns = columns.filter(
      (col) => !existingColNames.includes(col.columnName)
    );
    const existingColumns = columns.filter((col) =>
      existingColNames.includes(col.columnName)
    );

    if (newColumns.length === 0) {
      await Users.logUserActivity(
        "superadmin",
        email,
        "Set Table Structure",
        `No new columns to add — all columns already exist`,
        "failure",
        "",
        { deviceId, columns }
      );

      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "No new columns to add — all columns already exist",
      });
    }

    // Add only new columns
    for (const col of newColumns) {
      await SuperAdmin.setTableStructure(
        deviceId,
        col.columnName,
        col.type,
        col.size,
        col.after
      );
    }

    await Users.logUserActivity(
      "superadmin",
      email,
      "Set Table Structure",
      newColumns.length > 0 && existingColumns.length > 0
        ? `Added new columns: ${newColumns
            .map((c) => c.columnName)
            .join(", ")}\n
         Existing columns: ${existingColumns
           .map((c) => c.columnName)
           .join(", ")}`
        :  `Added new columns: ${newColumns.map((c) => c.columnName).join(", ")}`, 
       
      "success",
      "",
      { deviceId, newColumns }
    );

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Table structure updated successfully",
      addedColumns: newColumns,
    });
  } catch (error) {
    console.error("Error updating table structure:", error);
    await Users.logUserActivity(
      "superadmin",
      req.user?.email || "unknown",
      "Set Table Structure",
      `Error: ${error.message}`,
      "failure",
      "",
      { deviceId: req.query.deviceId, error: error.message }
    );
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update table structure",
      error: error.message || error,
    });
  }
};

const deleteTableColumnController = async (req, res) => {
  try {
    var { email } = req.user;
    var { deviceId } = req.query;
    var { columns } = req.body;

    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID is required",
      });
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Columns must be a non-empty array",
      });
    }

    const emptyColumns = [];
    const nonEmptyColumns = [];

    for (const col of columns) {
      const [rows] = await SuperAdmin.checkColumns(deviceId, col);

      if (rows.length > 0) {
        nonEmptyColumns.push(col);
      } else {
        emptyColumns.push(col);
      }
    }

    if (emptyColumns.length === 0) {
      await Users.logUserActivity(
        "superadmin",
        email,
        `Delete Table Column`,
        `No empty columns found to delete`,
        "failure",
        "",
        { deviceId, columns }
      );
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "No empty columns found to delete",
        nonEmptyColumns,
      });
    }

    // ✅ Only delete the empty ones
    const result = await SuperAdmin.DeleteTableColumns(deviceId, emptyColumns);
    await Users.logUserActivity(
      "superadmin",
      email,
      "Delete Table Column",
      nonEmptyColumns.length > 0
        ? `These columns have data: ${nonEmptyColumns.join(", ")}`
        : `Super Admin deleted columns of ${deviceId}`,
      "success",
      "",
      { deviceId, columns }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message:
        nonEmptyColumns.length > 0
          ? `These columns have data: ${nonEmptyColumns.join(", ")}`
          : "Parameters Deleted Successfully",
    });
  } catch (error) {
    console.error("Error deleting table columns:", error);
    await Users.logUserActivity(
      "superadmin",
      email,
      "Delete Table Column",
      `error: ${error.message}`,
      "failure",
      "",
      { deviceId, columns }
    );
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to delete table columns",
      error: error.message || error,
    });
  }
};

const updateColumnController = async (req, res) => {
  try {
    var { email } = req.user;
    var { deviceId } = req.query;
    var columns = req.body; // expecting array
    if (!deviceId || !Array.isArray(columns) || columns.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID and an array of columns are required",
      });
    }

    const result = await SuperAdmin.alterColumns(deviceId, columns);
    await Users.logUserActivity(
      "superadmin",
      email,
      "Update Table Column",
      `Super Admin updated columns of ${deviceId} `,
      "success",
      "",
      { deviceId, columns }
    );
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Columns updated successfully",
    });
  } catch (error) {
    console.error("Error updating column size:", error);
    await Users.logUserActivity(
      "superadmin",
      email,
      "Update Table Column",
      `error: ${error.message}`,
      "failure",
      "",
      { deviceId, columns }
    );
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update column sizes",
      error: error.message || error,
    });
  }
};

const changeSequenceController = async (req, res) => {
  try {
    var { email } = req.user;
    var { deviceId } = req.query;
    var columns = req.body;

    for (const col of columns) {
      if (!col.columnName || !col.id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Each column must have columnName and id",
        });
      }
      const tableStructure = await SuperAdmin.getTableStructure(deviceId);
      const result = tableStructure[0].map((col, index) => ({
        id: index + 1,
        columnName: col.Field,
        type: col.Type,
      }));
      const matched = result.find((tab) => tab.columnName === col.columnName);
      let after;
      if (matched.id > col.id) {
        after = result.find((tab) => tab.id === col.id - 1);
      } else if (matched.id < col.id) {
        after = result.find((tab) => tab.id === col.id);
      } else {
        after = null;
      }
      if (after != null) {
        const position = await SuperAdmin.changePositions(
          deviceId,
          col.columnName,
          matched.type,
          after.columnName
        );
      }
    }
    await Users.logUserActivity(
      "superadmin",
      email,
      "Change Column's Sequence",
      `Super Admin change sequence of columns of ${deviceId} `,
      "success",
      "",
      { deviceId, columns }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Sequence Changed successfully",
    });
  } catch (error) {
    console.error("Failed to Fetch Position", error);
    await Users.logUserActivity(
      "superadmin",
      email,
      "Change Columns' Sequence",
      `error: ${error.message}`,
      "failure",
      "",
      { deviceId, columns }
    );
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to Fetch Position",
      error: error.message || error,
    });
  }
};

const setMultipleTableStructureController = async (req, res) => {
  try {
    var { email } = req.user;
    var { deviceId } = req.query;
    var { newDeviceIds } = req.body;
    const emptyDeviceIds = [];
    const nonEmptyDeviceIds = [];
    const nonExistingDeviceIds = [];
    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Device Id is required `,
      });
    }
    if (!Array.isArray(newDeviceIds) || newDeviceIds.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Provide at least one device ID to set structure`,
      });
    }
    for (const device of newDeviceIds) {
      const existing = await Admin.checkDevice(device);
      console.log("ex", existing[0][0]);
      if (existing[0][0] !== undefined) {
        const checkDeviceId = await SuperAdmin.checkDeviceTable(device);
        if (checkDeviceId[0][0] === undefined) {
          emptyDeviceIds.push(device);
        } else {
          nonEmptyDeviceIds.push(device);
        }
      } else {
        nonExistingDeviceIds.push(device);
        console.log("nonexisting", nonExistingDeviceIds);
      }
    }

    const setStructure = await SuperAdmin.setMultipleTableStructure(
      deviceId,
      emptyDeviceIds
    );

    if (
      nonEmptyDeviceIds.length > 0 &&
      nonExistingDeviceIds.length > 0 &&
      emptyDeviceIds.length === 0
    ) {
      await Users.logUserActivity(
        "superadmin",
        email,
        "Set Multiple Table Structure",
        `These device IDs already have data: ${nonEmptyDeviceIds.join(
          ", "
        )} \n Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}`,
        "failure",
        "",
        { deviceId, newDeviceIds }
      );
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `These device IDs already have data: ${nonEmptyDeviceIds.join(
          ", "
        )} \n Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}`,
      });
    }
    if (nonEmptyDeviceIds.length > 0 && emptyDeviceIds.length === 0) {
      await Users.logUserActivity(
        "superadmin",
        email,
        "Set Multiple Table Structure",
        `These device IDs already have data: ${nonEmptyDeviceIds.join(", ")}`,
        "failure",
        "",
        { deviceId, newDeviceIds }
      );
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `These device IDs already have data: ${nonEmptyDeviceIds.join(
          ", "
        )}`,
      });
    }
    if (nonExistingDeviceIds.length > 0 && emptyDeviceIds.length === 0) {
      await Users.logUserActivity(
        "superadmin",
        email,
        "Set Multiple Table Structure",
        `Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}`,
        "failure",
        "",
        { deviceId, newDeviceIds }
      );
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}`,
      });
    }
    await Users.logUserActivity(
      "superadmin",
      email,
      "Set Multiple Table Structure",
      nonExistingDeviceIds.length > 0 &&
        nonEmptyDeviceIds.length > 0 &&
        emptyDeviceIds.length > 0
        ? `Invalid Device Ids: ${nonExistingDeviceIds.join(
            ", "
          )} \n These device Ids already have data: ${nonEmptyDeviceIds.join(
            ", "
          )} \n Updated structure of device Ids: ${emptyDeviceIds.join(", ")}`
        : nonEmptyDeviceIds.length > 0 && emptyDeviceIds.length > 0
        ? `These device Ids already have data: ${nonEmptyDeviceIds.join(", ")}
        \n Updated structure of device Ids: ${emptyDeviceIds.join(", ")}`
        : nonExistingDeviceIds.length > 0 && emptyDeviceIds.length > 0
        ? `Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}
        \n Updated structure of device Ids: ${emptyDeviceIds.join(", ")}`
        : `Super Admin set structures of tables: ${newDeviceIds} like ${deviceId} `,

      "success",
      "",
      { deviceId, newDeviceIds }
    );
    res.status(StatusCodes.OK).json({
      success: true,
      message:
        nonExistingDeviceIds.length > 0 &&
        nonEmptyDeviceIds.length > 0 &&
        emptyDeviceIds.length > 0
          ? ` Invalid Device Ids: ${nonExistingDeviceIds.join(
              ", "
            )} \n These device Ids already have data: ${nonEmptyDeviceIds.join(
              ", "
            )} \n Updated structure of device Ids: ${emptyDeviceIds.join(", ")}`
          : nonEmptyDeviceIds.length > 0 && emptyDeviceIds.length > 0
          ? `These device Ids already have data: ${nonEmptyDeviceIds.join(", ")}
        \n Updated structure of device Ids: ${emptyDeviceIds.join(", ")}`
          : nonExistingDeviceIds.length > 0 && emptyDeviceIds.length > 0
          ? `Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}
        \n Updated structure of device Ids: ${emptyDeviceIds.join(", ")}`
          : `Super Admin set structures of tables: ${newDeviceIds} like ${deviceId} `,
    });
  } catch (error) {
    console.error("Failed to set structure", error);
    await Users.logUserActivity(
      "superadmin",
      email,
      "Set Multiple Table Structure",
      `error: ${error.message}`,
      "failure",
      "",
      { deviceId, newDeviceIds }
    );
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to Set Structure",
      error: error.message || error,
    });
  }
};

module.exports = {
  getAllParametersController,
  getTableStructureController,
  setTableStructureController,
  deleteTableColumnController,
  updateColumnController,
  changeSequenceController,
  setMultipleTableStructureController,
};
