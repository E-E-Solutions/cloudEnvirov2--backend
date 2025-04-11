

const GetTheme=async(req,res)=>{
    try{
        const compId=req.compId;
      const theme=await Theme.find(compId);
      

        console.log(settings[0])
        res.status(200).json({success:"true", data:settings[0]});
    }
    catch(er){
        console.log(er)
        res.status(500).json({success:"false",message:"Internal Server Error"})
    }
    }