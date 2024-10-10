const Settings =require("../db/Settings");
const {validateRequestBody}=require("../utils/common")


const GetSettings=async(req,res)=>{
try{
    const {email}=req.user;

    const settingsObj= new  Settings({email});
    const settings=await settingsObj.getSettings();
    console.log(settings[0])
    res.status(200).json({success:"true", data:settings[0]});
}
catch(er){
    console.log(er)
    res.status(500).json({success:"false",message:"Internal Server Error"})
}
}

const SetMapSettings=async(req,res)=>{
    try{

        const { email } = req.user;
        
        if (!validateRequestBody(req.body, ["mapCenter", "zoomLevel"])) {
            return res.status(400).json({ success: false, message: "Request body should contain - mapCenter and zoomLevel" });
        }
        const {zoomLevel,mapCenter}=req.body;

        const settings= await Settings.setMapSettings(JSON.stringify({zoomLevel,mapCenter}),email);
        if(settings[0]?.affectedRows>0){
            return res.status(200).json({ success: "true", message: "Map settings updated successfully"});
        }
         res.status(501).json({ success: "false", message: "Failed to update map settings!"});



    }
    catch(er){
        console.log(er);
        return res.status(500).json({success:"false", message: "Something Went Wrong. |  Error: " + er});
    }

}

const SetParaInfo=async(req,res)=>{
    try{
        const { email } = req.user;
        const {paraInfo}=req.body;
        const oldSettings=new Settings(email);
        const [oldSettingsData]=await oldSettings.getSettings();
        // Check if oldSettingsData is valid
        if (!oldSettingsData || oldSettingsData.length === 0) {
            return res.status(404).json({ success: "false", message: "Settings not found" });
        }
        const oldParaInfo=JSON.parse(oldSettingsData?.[0]?.para_info ||  "{}");
        const data=JSON.stringify({ ...oldParaInfo, ...paraInfo });
        const settings= await Settings.setParaSettings(data,email);
        if(settings[0]?.affectedRows>0){
            return res.status(200).json({ success: "true", message: "Para Info updated successfully"});
        }
         res.status(501).json({ success: "false", message: "Failed to update Para Info!"});
    }
    catch(er){
        console.log(er);
        return res.status(500).json({success:"false", message: "Something Went Wrong. |  Error: " + er});
    }

}

module.exports={GetSettings,SetMapSettings,SetParaInfo}